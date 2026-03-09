import {
  RekognitionClient,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const COLLECTION_ID =
  process.env.REKOGNITION_COLLECTION_ID ?? "photo-space-faces"
const MATCH_THRESHOLD = 90 // Rekognition similarity threshold (0-100)

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
  // ── 1. Load unassigned faces ──
  console.log("Loading unassigned faces...")
  const unassigned = (await sql`
    SELECT id, aws_face_id FROM faces
    WHERE aws_face_id IS NOT NULL AND person_id IS NULL
    ORDER BY created_at ASC
  `) as { id: string; aws_face_id: string }[]

  if (unassigned.length === 0) {
    console.log("No unassigned faces — nothing to do.")
    return
  }

  console.log(`Found ${unassigned.length} unassigned face(s).`)

  // ── 2. Load existing assigned faces → awsFaceId → personId map ──
  const assigned = (await sql`
    SELECT aws_face_id, person_id FROM faces
    WHERE aws_face_id IS NOT NULL AND person_id IS NOT NULL
  `) as { aws_face_id: string; person_id: string }[]

  const awsToPersonId = new Map<string, string>()
  for (const row of assigned) {
    awsToPersonId.set(row.aws_face_id, row.person_id)
  }

  console.log(`${assigned.length} already-assigned face(s) loaded for matching.`)

  // ── 3. For each unassigned face, SearchFaces in Rekognition ──
  // Build awsFaceId → dbId map for unassigned faces
  const awsToUnassignedDbId = new Map<string, string>()
  for (const row of unassigned) {
    awsToUnassignedDbId.set(row.aws_face_id, row.id)
  }

  // Direct assignments: face dbId → personId (matched to existing person)
  const directAssign = new Map<string, string>()
  // UnionFind for unassigned faces that match each other but not an existing person
  const uf = new UnionFind()
  for (const row of unassigned) {
    uf.add(row.id)
  }

  console.log(`\nSearching for matches (threshold=${MATCH_THRESHOLD})...\n`)

  let searchCount = 0
  for (const row of unassigned) {
    try {
      const result = await rekognition.send(
        new SearchFacesCommand({
          CollectionId: COLLECTION_ID,
          FaceId: row.aws_face_id,
          FaceMatchThreshold: MATCH_THRESHOLD,
          MaxFaces: 100,
        })
      )

      // Rekognition returns matches sorted by similarity (highest first)
      for (const match of result.FaceMatches ?? []) {
        const matchedAwsId = match.Face?.FaceId
        if (!matchedAwsId) continue

        // Check if match is an already-assigned face → direct assign to that person
        const existingPersonId = awsToPersonId.get(matchedAwsId)
        if (existingPersonId && !directAssign.has(row.id)) {
          directAssign.set(row.id, existingPersonId)
          continue
        }

        // Check if match is another unassigned face → union them
        const matchedDbId = awsToUnassignedDbId.get(matchedAwsId)
        if (matchedDbId) {
          uf.union(row.id, matchedDbId)
        }
      }
    } catch (err) {
      console.error(`  Error searching face ${row.aws_face_id}:`, err)
    }

    searchCount++
    if (searchCount % 20 === 0) {
      console.log(`  Searched ${searchCount}/${unassigned.length}...`)
    }
  }

  // ── 4. Assign faces ──
  const affectedPersonIds = new Set<string>()

  // 4a. Direct assignments to existing persons
  let directCount = 0
  for (const [faceId, personId] of directAssign) {
    await sql`UPDATE faces SET person_id = ${personId} WHERE id = ${faceId}::uuid`
    affectedPersonIds.add(personId)
    directCount++
  }
  if (directCount > 0) {
    console.log(`\nAssigned ${directCount} face(s) to existing persons.`)
  }

  // 4b. Process UnionFind clusters for remaining unassigned faces
  const clusters = uf.components()
  let newPersonCount = 0

  for (const [, faceIds] of clusters) {
    // Skip faces that were already directly assigned
    const remaining = faceIds.filter((id) => !directAssign.has(id))
    if (remaining.length === 0) continue

    // Check if any face in this cluster was directly assigned → use that person
    const clusterPersonId = faceIds
      .map((id) => directAssign.get(id))
      .find((pid) => pid !== undefined)

    if (clusterPersonId) {
      // Assign remaining faces to the same existing person
      await sql`
        UPDATE faces SET person_id = ${clusterPersonId}
        WHERE id = ANY(${remaining}::uuid[])
      `
      affectedPersonIds.add(clusterPersonId)
    } else {
      // Create a new person for this cluster
      const result = await sql`
        INSERT INTO persons (face_count) VALUES (${remaining.length})
        RETURNING id
      `
      const newPersonId = result[0].id
      await sql`
        UPDATE faces SET person_id = ${newPersonId}
        WHERE id = ANY(${remaining}::uuid[])
      `
      affectedPersonIds.add(newPersonId)
      newPersonCount++
    }
  }

  if (newPersonCount > 0) {
    console.log(`Created ${newPersonCount} new person(s).`)
  }

  // ── 5. Update face_count on all affected persons ──
  if (affectedPersonIds.size > 0) {
    const ids = Array.from(affectedPersonIds)
    await sql`
      UPDATE persons SET face_count = (
        SELECT COUNT(*) FROM faces WHERE faces.person_id = persons.id
      )
      WHERE id = ANY(${ids}::uuid[])
    `
  }

  // ── Summary ──
  const persons = await sql`SELECT id, name, face_count FROM persons ORDER BY face_count DESC`
  console.log(`\n--- Summary ---`)
  console.log(`Total persons: ${persons.length}`)
  for (const p of persons) {
    console.log(`  ${p.name || "(unnamed)"}: ${p.face_count} faces`)
  }

  console.log(`\nDone. Existing persons preserved, ${unassigned.length} new face(s) processed.`)
}

main().catch(console.error)
