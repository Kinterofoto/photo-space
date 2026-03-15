import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} from "@aws-sdk/client-rekognition"
import { neon } from "@neondatabase/serverless"

// ── Config ──
const MIN_CONFIDENCE = 90 // Rekognition confidence threshold
const CONCURRENCY = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // Rekognition 5MB limit

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

// ── Ensure Rekognition collection exists ──
async function ensureCollection() {
  try {
    await rekognition.send(
      new DescribeCollectionCommand({ CollectionId: COLLECTION_ID })
    )
    console.log(`Rekognition collection "${COLLECTION_ID}" exists.`)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.name === "ResourceNotFoundException"
    ) {
      await rekognition.send(
        new CreateCollectionCommand({ CollectionId: COLLECTION_ID })
      )
      console.log(`Created Rekognition collection "${COLLECTION_ID}".`)
    } else {
      throw err
    }
  }
}

// ── Fetch image bytes ──
async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Get a Cloudinary URL resized to fit within 5MB ──
function getResizedUrl(originalUrl: string, maxDim: number): string {
  // Insert w_maxDim,c_limit transform into Cloudinary URL
  // e.g. .../image/upload/v123/... → .../image/upload/w_maxDim,c_limit/v123/...
  return originalUrl.replace(
    "/image/upload/",
    `/image/upload/w_${maxDim},c_limit/`
  )
}

// ── Build Cloudinary face thumbnail URL from normalized bounding box ──
function buildThumbnailUrl(
  photoUrl: string,
  box: { x: number; y: number; w: number; h: number },
  imgWidth: number,
  imgHeight: number
): string {
  // Convert normalized coords to pixels with padding
  const pad = 0.3
  const cx = (box.x + box.w / 2) * imgWidth
  const cy = (box.y + box.h / 2) * imgHeight
  const side = Math.max(box.w * imgWidth, box.h * imgHeight) * (1 + pad * 2)

  const cropX = Math.max(0, Math.round(cx - side / 2))
  const cropY = Math.max(0, Math.round(cy - side / 2))
  const cropW = Math.round(side)
  const cropH = Math.round(side)

  return photoUrl.replace(
    "/image/upload/",
    `/image/upload/c_crop,w_${cropW},h_${cropH},x_${cropX},y_${cropY}/c_fill,w_80,h_80/f_webp,q_auto:low/`
  )
}

// ── Process one photo ──
async function processPhoto(
  photoName: string,
  photoUrl: string,
  imgWidth: number,
  imgHeight: number
) {
  // Check if already processed
  const existing = await sql`
    SELECT id FROM faces WHERE photo_name = ${photoName} LIMIT 1
  `
  if (existing.length > 0) {
    console.log(`  Skipping ${photoName} (already processed)`)
    return
  }

  // Fetch image bytes (resize if needed for Rekognition 5MB limit)
  let imageBytes = await fetchImageBytes(photoUrl)

  if (imageBytes.length > MAX_IMAGE_BYTES) {
    console.log(
      `  ${photoName}: image ${(imageBytes.length / 1e6).toFixed(1)}MB > 5MB, resizing...`
    )
    imageBytes = await fetchImageBytes(getResizedUrl(photoUrl, 2048))
  }

  // ── Rekognition: IndexFaces with ALL landmarks ──
  try {
    const indexResult = await rekognition.send(
      new IndexFacesCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: imageBytes },
        ExternalImageId: photoName,
        DetectionAttributes: ["ALL"],
        QualityFilter: "AUTO",
      })
    )

    const records = (indexResult.FaceRecords ?? []).filter(
      (r) =>
        r.Face?.FaceId &&
        r.Face.BoundingBox &&
        (r.Face.Confidence ?? 0) >= MIN_CONFIDENCE
    )

    if (records.length === 0) {
      console.log(`  ${photoName}: no faces`)
      return
    }

    for (const record of records) {
      const face = record.Face!
      const detail = record.FaceDetail
      const box = {
        x: face.BoundingBox!.Left ?? 0,
        y: face.BoundingBox!.Top ?? 0,
        w: face.BoundingBox!.Width ?? 0,
        h: face.BoundingBox!.Height ?? 0,
      }

      // Extract Rekognition's ~30 landmarks as normalized {x, y}
      const landmarks = (detail?.Landmarks ?? []).map((lm) => ({
        x: lm.X ?? 0,
        y: lm.Y ?? 0,
      }))

      const thumbnail = buildThumbnailUrl(photoUrl, box, imgWidth, imgHeight)

      await sql`
        INSERT INTO faces (photo_name, aws_face_id, landmarks, box_x, box_y, box_w, box_h, thumbnail)
        VALUES (
          ${photoName},
          ${face.FaceId!},
          ${JSON.stringify(landmarks)}::jsonb,
          ${box.x},
          ${box.y},
          ${box.w},
          ${box.h},
          ${thumbnail}
        )
      `
    }

    console.log(`  ${photoName}: ${records.length} face(s) indexed`)
  } catch (err) {
    console.error(`  ${photoName}: Rekognition error:`, err)
  }
}

// ── Main ──
async function main() {
  const eventFilter = process.argv[2] // optional event name filter

  await ensureCollection()

  const allPhotos = eventFilter
    ? await sql`SELECT name, url, width, height FROM photos WHERE event = ${eventFilter} ORDER BY name ASC`
    : await sql`SELECT name, url, width, height FROM photos ORDER BY name ASC`

  if (allPhotos.length === 0) {
    console.error(
      eventFilter
        ? `No photos found for event "${eventFilter}". Check the event name or run 'bun run populate-photos' first.`
        : "No photos in database. Run 'bun run populate-photos' first."
    )
    process.exit(1)
  }

  console.log(
    eventFilter
      ? `\nProcessing ${allPhotos.length} photos for event "${eventFilter}" (concurrency=${CONCURRENCY})...\n`
      : `\nProcessing ${allPhotos.length} photos (concurrency=${CONCURRENCY})...\n`
  )

  for (let i = 0; i < allPhotos.length; i += CONCURRENCY) {
    const batch = allPhotos.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (photo, j) => {
        const idx = i + j + 1
        console.log(`[${idx}/${allPhotos.length}] ${photo.name}`)
        try {
          await processPhoto(photo.name, photo.url, photo.width ?? 2048, photo.height ?? 2048)
        } catch (err) {
          console.error(`  Error processing ${photo.name}:`, err)
        }
      })
    )
    console.log(
      `  ── batch done (${Math.min(i + CONCURRENCY, allPhotos.length)}/${allPhotos.length}) ──`
    )
  }

  const totalFaces = await sql`SELECT COUNT(*) as n FROM faces`
  console.log(`\nDone. ${totalFaces[0].n} total faces indexed.`)
  console.log(`Run 'bun run cluster-faces' to group them by identity.`)
}

main().catch(console.error)
