import { createClient } from "@supabase/supabase-js"
import { writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { resolve, dirname } from "path"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const BUCKET = "photos"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // List all images
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

  console.log(`Found ${imageFiles.length} images. Generating thumbnails...`)

  const manifest: { name: string; thumb: string }[] = []
  const BATCH = 20

  for (let i = 0; i < imageFiles.length; i += BATCH) {
    const batch = imageFiles.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (file) => {
        const thumbUrl = `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${file.name}?width=300&height=300&resize=contain&quality=30`
        try {
          const res = await fetch(thumbUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = Buffer.from(await res.arrayBuffer())
          const b64 = buf.toString("base64")
          const mime = res.headers.get("content-type") || "image/jpeg"
          return { name: file.name, thumb: `data:${mime};base64,${b64}` }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`  Failed: ${file.name} - ${message}`)
          return null
        }
      })
    )
    results.filter(Boolean).forEach((r) => manifest.push(r!))
    console.log(
      `  ${Math.min(i + BATCH, imageFiles.length)}/${imageFiles.length}`
    )
  }

  const json = JSON.stringify(manifest)
  const sizeKB = Math.round(json.length / 1024)
  console.log(`\nManifest: ${manifest.length} photos, ${sizeKB}kb`)

  // Save locally
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outPath = resolve(__dirname, "../public/manifest.json")
  writeFileSync(outPath, json)
  console.log("Saved to public/manifest.json")

  // Also try to upload to bucket
  await supabase.storage.from(BUCKET).remove(["manifest.json"])
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload("manifest.json", json, { contentType: "application/json" })
  if (error) console.error("Bucket upload failed (use local):", error.message)
  else console.log("Also uploaded to bucket")
}

main()
