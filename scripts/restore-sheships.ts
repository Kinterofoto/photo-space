import { v2 as cloudinary } from "cloudinary"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)
const EVENT = "sheships"

// Read local files to know which photos to restore
import { readdir } from "fs/promises"
const DIR = "/tmp/sheships/SHESHIPS"

async function main() {
  const files = await readdir(DIR)
  const imageFiles = files.filter((f) =>
    f.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)
  )

  console.log(`Found ${imageFiles.length} images to restore for event "${EVENT}"\n`)

  let restored = 0
  let skipped = 0
  const BATCH = 10

  for (let i = 0; i < imageFiles.length; i += BATCH) {
    const batch = imageFiles.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (file) => {
        const publicId = `photo-space/${file.replace(/\.[^.]+$/, "")}`

        // Check if already in DB
        const existing = await sql`
          SELECT id FROM photos WHERE name = ${file} LIMIT 1
        `
        if (existing.length > 0) {
          skipped++
          return
        }

        try {
          // Get metadata from Cloudinary (image already exists there)
          const info = await cloudinary.api.resource(publicId, {
            resource_type: "image",
          })

          const url = info.secure_url
          const thumbUrl = cloudinary.url(publicId, {
            width: 400,
            height: 400,
            crop: "fill",
            quality: "auto:low",
            format: "webp",
            secure: true,
          })

          await sql`
            INSERT INTO photos (name, url, thumb_url, width, height, event)
            VALUES (
              ${file},
              ${url},
              ${thumbUrl},
              ${info.width},
              ${info.height},
              ${EVENT}
            )
            ON CONFLICT (name) DO NOTHING
          `

          restored++
          console.log(`  [ok] ${file} (${info.width}x${info.height})`)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err)
          console.error(`  [err] ${file}: ${msg}`)
        }
      })
    )
    console.log(`  ${Math.min(i + BATCH, imageFiles.length)}/${imageFiles.length}`)
  }

  console.log(`\nDone. Restored: ${restored}, Skipped: ${skipped}`)
  const count = await sql`SELECT COUNT(*) as n FROM photos WHERE event = ${EVENT}`
  console.log(`Total "${EVENT}" photos in DB: ${count[0].n}`)
}

main().catch(console.error)
