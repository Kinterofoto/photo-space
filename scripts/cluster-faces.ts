import {
  RekognitionClient,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const COLLECTION_ID =
  process.env.REKOGNITION_COLLECTION_ID ?? "photo-space-faces"
const MATCH_THRESHOLD = 80 // Rekognition similarity threshold (0-100)

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// ── Union-Find ──
class UnionFind {
  parent: Map<string, string> = new Map()
  rank: Map<string, number> = new Map()

  add(x: string) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
    }
  }

  find(x: string): string {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!))
    }
    return this.parent.get(x)!
  }

  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return

    const rankA = this.rank.get(ra)!
    const rankB = this.rank.get(rb)!
    if (rankA < rankB) {
      this.parent.set(ra, rb)
    } else if (rankA > rankB) {
      this.parent.set(rb, ra)
    } else {
      this.parent.set(rb, ra)
      this.rank.set(ra, rankA + 1)
    }
  }

  components(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(key)
    }
    return groups
  }
}

async function main() {
  console.log("Loading faces from database...")

  const rows = (await sql`
    SELECT id, aws_face_id FROM faces WHERE aws_face_id IS NOT NULL ORDER BY created_at ASC
  `) as { id: string; aws_face_id: string }[]

  if (rows.length === 0) {
    console.error("No faces in database. Run 'bun run process-faces' first.")
    process.exit(1)
  }

  console.log(`Loaded ${rows.length} faces.`)

  // Build a map from awsFaceId → dbId
  const awsToDb = new Map<string, string>()
  for (const row of rows) {
    awsToDb.set(row.aws_face_id, row.id)
  }

  // Union-Find over DB face IDs
  const uf = new UnionFind()
  for (const row of rows) {
    uf.add(row.id)
  }

  // For each face, SearchFaces to find matches
  console.log(
    `Searching for matches (threshold=${MATCH_THRESHOLD})...\n`
  )

  let searchCount = 0
  for (const row of rows) {
    try {
      const result = await rekognition.send(
        new SearchFacesCommand({
          CollectionId: COLLECTION_ID,
          FaceId: row.aws_face_id,
          FaceMatchThreshold: MATCH_THRESHOLD,
          MaxFaces: 100,
        })
      )

      for (const match of result.FaceMatches ?? []) {
        const matchedAwsId = match.Face?.FaceId
        if (!matchedAwsId) continue

        const matchedDbId = awsToDb.get(matchedAwsId)
        if (matchedDbId) {
          uf.union(row.id, matchedDbId)
        }
      }
    } catch (err) {
      console.error(`  Error searching face ${row.aws_face_id}:`, err)
    }

    searchCount++
    if (searchCount % 20 === 0) {
      console.log(`  Searched ${searchCount}/${rows.length}...`)
    }
  }

  const clusters = uf.components()
  console.log(`\nFound ${clusters.size} clusters.`)

  // Clear existing person assignments
  console.log("Clearing existing person assignments...")
  await sql`UPDATE faces SET person_id = NULL`
  await sql`DELETE FROM persons`

  // Create persons and assign faces
  let clusterIdx = 0
  for (const [, faceIds] of clusters) {
    const result = await sql`
      INSERT INTO persons (face_count) VALUES (${faceIds.length})
      RETURNING id
    `
    const personId = result[0].id

    await sql`
      UPDATE faces SET person_id = ${personId}
      WHERE id = ANY(${faceIds}::uuid[])
    `

    console.log(
      `  cluster_${clusterIdx++}: ${faceIds.length} face(s) → person ${personId}`
    )
  }

  // Summary
  const persons = await sql`SELECT id, name, face_count FROM persons ORDER BY face_count DESC`
  console.log(`\n--- Summary ---`)
  console.log(`Total persons: ${persons.length}`)
  for (const p of persons) {
    console.log(`  ${p.name || "(unnamed)"}: ${p.face_count} faces`)
  }

  const singles = persons.filter((p) => Number(p.face_count) === 1)
  if (singles.length > 0) {
    console.log(
      `\nNote: ${singles.length} person(s) with only 1 face — may be unique or false detections`
    )
  }

  console.log(
    `\nDone. You can re-run this script anytime to re-cluster.`
  )
}

main().catch(console.error)
