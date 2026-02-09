import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} from "@aws-sdk/client-rekognition"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const H = require("@vladmandic/human")
import * as canvas from "canvas"
import { neon } from "@neondatabase/serverless"

// ── Config ──
const MIN_CONFIDENCE = 90 // Rekognition confidence threshold
const CONCURRENCY = 3 // lower than before due to API calls
const IOU_THRESHOLD = 0.3 // min IoU to match Rekognition↔human faces
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

// ── Init @vladmandic/human ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initHuman(): Promise<any> {
  const config = {
    modelBasePath: "https://vladmandic.github.io/human-models/models/",
    backend: "tensorflow",
    face: {
      enabled: true,
      detector: { enabled: true, rotation: false },
      mesh: { enabled: true },
      iris: { enabled: false },
      description: { enabled: false },
      emotion: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  }

  const human = new H.Human(config)
  await human.load()
  console.log("@vladmandic/human models loaded.")
  return human
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

// ── IoU between two normalized boxes ──
function iou(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)

  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = a.w * a.h
  const areaB = b.w * b.h

  return inter / (areaA + areaB - inter)
}

// ── Process one photo ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPhoto(
  human: any,
  photoName: string,
  photoUrl: string
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
  let usedUrl = photoUrl

  if (imageBytes.length > MAX_IMAGE_BYTES) {
    console.log(
      `  ${photoName}: image ${(imageBytes.length / 1e6).toFixed(1)}MB > 5MB, resizing...`
    )
    usedUrl = getResizedUrl(photoUrl, 2048)
    imageBytes = await fetchImageBytes(usedUrl)
  }

  // Get image dimensions via canvas
  const img = new canvas.Image()
  img.src = imageBytes
  const imgWidth = img.width
  const imgHeight = img.height

  // ── Rekognition: IndexFaces ──
  let rekFaces: {
    faceId: string
    box: { x: number; y: number; w: number; h: number }
    confidence: number
  }[] = []

  try {
    const indexResult = await rekognition.send(
      new IndexFacesCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: imageBytes },
        ExternalImageId: photoName,
        DetectionAttributes: ["DEFAULT"],
        QualityFilter: "AUTO",
      })
    )

    rekFaces = (indexResult.FaceRecords ?? [])
      .filter(
        (r) =>
          r.Face?.FaceId &&
          r.Face.BoundingBox &&
          (r.Face.Confidence ?? 0) >= MIN_CONFIDENCE
      )
      .map((r) => ({
        faceId: r.Face!.FaceId!,
        box: {
          x: r.Face!.BoundingBox!.Left ?? 0,
          y: r.Face!.BoundingBox!.Top ?? 0,
          w: r.Face!.BoundingBox!.Width ?? 0,
          h: r.Face!.BoundingBox!.Height ?? 0,
        },
        confidence: r.Face!.Confidence ?? 0,
      }))
  } catch (err) {
    console.error(`  ${photoName}: Rekognition error:`, err)
    return
  }

  if (rekFaces.length === 0) {
    console.log(`  ${photoName}: no faces (Rekognition)`)
    return
  }

  // ── @vladmandic/human: face mesh landmarks ──
  // Create a tensor from the image buffer
  const inputCanvas = canvas.createCanvas(imgWidth, imgHeight)
  const ctx = inputCanvas.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight)

  // Create a tensor-compatible input
  const tensor = human.tf.tensor4d(
    new Float32Array(imageData.data).map((v: number) => v / 255),
    [1, imgHeight, imgWidth, 4]
  )
  // Remove alpha channel → [1, h, w, 3]
  const rgb = human.tf.slice(tensor, [0, 0, 0, 0], [-1, -1, -1, 3])
  tensor.dispose()

  const humanResult = await human.detect(rgb)
  rgb.dispose()

  const humanFaces = (humanResult.face ?? []).map((f) => ({
    box: {
      x: f.box[0] / imgWidth,
      y: f.box[1] / imgHeight,
      w: f.box[2] / imgWidth,
      h: f.box[3] / imgHeight,
    },
    landmarks: (f.mesh ?? []).map((pt) => ({
      x: pt[0] / imgWidth,
      y: pt[1] / imgHeight,
    })),
  }))

  // ── Match Rekognition faces ↔ human faces by IoU ──
  let matchedCount = 0

  for (const rekFace of rekFaces) {
    // Find best matching human face
    let bestIoU = 0
    let bestHumanIdx = -1

    for (let i = 0; i < humanFaces.length; i++) {
      const score = iou(rekFace.box, humanFaces[i].box)
      if (score > bestIoU) {
        bestIoU = score
        bestHumanIdx = i
      }
    }

    const landmarks =
      bestIoU >= IOU_THRESHOLD && bestHumanIdx >= 0
        ? humanFaces[bestHumanIdx].landmarks
        : [] // no mesh match — will render as dots fallback

    if (bestIoU >= IOU_THRESHOLD) matchedCount++

    const thumbnail = buildThumbnailUrl(
      photoUrl, // use original URL for thumbnail
      rekFace.box,
      imgWidth,
      imgHeight
    )

    await sql`
      INSERT INTO faces (photo_name, aws_face_id, landmarks, box_x, box_y, box_w, box_h, thumbnail)
      VALUES (
        ${photoName},
        ${rekFace.faceId},
        ${JSON.stringify(landmarks)}::jsonb,
        ${rekFace.box.x},
        ${rekFace.box.y},
        ${rekFace.box.w},
        ${rekFace.box.h},
        ${thumbnail}
      )
    `
  }

  console.log(
    `  ${photoName}: ${rekFaces.length} face(s) indexed, ${matchedCount} mesh-matched`
  )
}

// ── Main ──
async function main() {
  await ensureCollection()
  const human = await initHuman()

  const allPhotos = await sql`SELECT name, url FROM photos ORDER BY name ASC`

  if (allPhotos.length === 0) {
    console.error("No photos in database. Run 'bun run populate-photos' first.")
    process.exit(1)
  }

  console.log(
    `\nProcessing ${allPhotos.length} photos (concurrency=${CONCURRENCY})...\n`
  )

  for (let i = 0; i < allPhotos.length; i += CONCURRENCY) {
    const batch = allPhotos.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (photo, j) => {
        const idx = i + j + 1
        console.log(`[${idx}/${allPhotos.length}] ${photo.name}`)
        try {
          await processPhoto(human, photo.name, photo.url)
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
  console.log(`\nDone. ${totalFaces[0].n} faces indexed.`)
  console.log(`Run 'bun run cluster-faces' to group them by identity.`)
}

main().catch(console.error)
