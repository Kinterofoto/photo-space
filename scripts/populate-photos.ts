import { v2 as cloudinary } from "cloudinary"
import { createClient } from "@supabase/supabase-js"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const BUCKET = "photos"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Cloudinary auto-configures from CLOUDINARY_URL env var

async function main() {
  // List all images from Supabase
  let allFiles: { name: string }[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error) {
      console.error(error)
      break
    }
    if (!data || data.length === 0) break
    allFiles = allFiles.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }

  const imageFiles = allFiles.filter((f) =>
    f.name.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)
  )

  console.log(`Found ${imageFiles.length} images. Uploading to Cloudinary...\n`)

  const BATCH = 5

  for (let i = 0; i < imageFiles.length; i += BATCH) {
    const batch = imageFiles.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (file) => {
        const publicId = `photo-space/${file.name.replace(/\.[^.]+$/, "")}`

        // Check if already uploaded
        const existing = await sql`
          SELECT id FROM photos WHERE name = ${file.name} LIMIT 1
        `
        if (existing.length > 0) {
          console.log(`  [skip] ${file.name} (already in DB)`)
          return
        }

        // Source URL from Supabase
        const sourceUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file.name}`

        try {
          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(sourceUrl, {
            public_id: publicId,
            folder: "",
            overwrite: false,
            resource_type: "image",
          })

          // Build URLs using Cloudinary transforms
          const url = result.secure_url
          const thumbUrl = cloudinary.url(result.public_id, {
            width: 400,
            height: 400,
            crop: "fill",
            quality: "auto:low",
            format: "webp",
            secure: true,
          })

          // Insert into DB
          await sql`
            INSERT INTO photos (name, url, thumb_url, width, height)
            VALUES (
              ${file.name},
              ${url},
              ${thumbUrl},
              ${result.width},
              ${result.height}
            )
            ON CONFLICT (name) DO NOTHING
          `

          console.log(`  [ok] ${file.name} (${result.width}x${result.height})`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`  [err] ${file.name}: ${msg}`)
        }
      })
    )
    console.log(`  ${Math.min(i + BATCH, imageFiles.length)}/${imageFiles.length}`)
  }

  const count = await sql`SELECT COUNT(*) as n FROM photos`
  console.log(`\nDone. ${count[0].n} photos in database.`)
}

main().catch(console.error)
