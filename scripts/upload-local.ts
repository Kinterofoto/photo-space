import { v2 as cloudinary } from "cloudinary"
import { neon } from "@neondatabase/serverless"
import { readdir } from "fs/promises"
import { resolve } from "path"

const sql = neon(process.env.DATABASE_URL!)

// Cloudinary auto-configures from CLOUDINARY_URL env var

const FOLDER = process.argv[2]
const EVENT = process.argv[3] || "sheships"

if (!FOLDER) {
  console.error("Usage: bun run scripts/upload-local.ts <folder-path> [event-name]")
  process.exit(1)
}

async function main() {
  const dir = resolve(FOLDER)
  const files = await readdir(dir)
  const imageFiles = files.filter((f) =>
    f.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)
  )

  console.log(`Found ${imageFiles.length} images in ${dir}`)
  console.log(`Event: ${EVENT}\n`)

  const BATCH = 5

  for (let i = 0; i < imageFiles.length; i += BATCH) {
    const batch = imageFiles.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (file) => {
        const publicId = `photo-space/${file.replace(/\.[^.]+$/, "")}`

        // Check if already uploaded
        const existing = await sql`
          SELECT id FROM photos WHERE name = ${file} LIMIT 1
        `
        if (existing.length > 0) {
          console.log(`  [skip] ${file} (already in DB)`)
          return
        }

        const filePath = resolve(dir, file)

        try {
          // Upload to Cloudinary from local file
          const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            folder: "",
            overwrite: false,
            resource_type: "image",
          })

          const url = result.secure_url
          const thumbUrl = cloudinary.url(result.public_id, {
            width: 400,
            height: 400,
            crop: "fill",
            quality: "auto:low",
            format: "webp",
            secure: true,
          })

          // Insert into DB with event tag
          await sql`
            INSERT INTO photos (name, url, thumb_url, width, height, event)
            VALUES (
              ${file},
              ${url},
              ${thumbUrl},
              ${result.width},
              ${result.height},
              ${EVENT}
            )
            ON CONFLICT (name) DO NOTHING
          `

          console.log(`  [ok] ${file} (${result.width}x${result.height})`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`  [err] ${file}: ${msg}`)
        }
      })
    )
    console.log(`  ${Math.min(i + BATCH, imageFiles.length)}/${imageFiles.length}`)
  }

  const count = await sql`SELECT COUNT(*) as n FROM photos WHERE event = ${EVENT}`
  console.log(`\nDone. ${count[0].n} photos for event "${EVENT}" in database.`)
}

main().catch(console.error)
