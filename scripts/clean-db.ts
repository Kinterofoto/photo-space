import {
  RekognitionClient,
  DeleteCollectionCommand,
} from "@aws-sdk/client-rekognition"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const COLLECTION_ID =
  process.env.REKOGNITION_COLLECTION_ID ?? "photo-space-faces"

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function main() {
  // Delete Rekognition collection
  console.log("Deleting Rekognition collection...")
  try {
    await rekognition.send(
      new DeleteCollectionCommand({ CollectionId: COLLECTION_ID })
    )
    console.log(`  Collection "${COLLECTION_ID}": deleted`)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.name === "ResourceNotFoundException"
    ) {
      console.log(`  Collection "${COLLECTION_ID}": not found (already clean)`)
    } else {
      throw err
    }
  }

  // Truncate tables
  console.log("Truncating all tables...")

  await sql`TRUNCATE faces CASCADE`
  console.log("  faces: cleared")

  await sql`TRUNCATE persons CASCADE`
  console.log("  persons: cleared")

  await sql`TRUNCATE photos CASCADE`
  console.log("  photos: cleared")

  console.log("\nAll tables and Rekognition collection cleaned.")
}

main().catch(console.error)
