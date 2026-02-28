import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { db } from "@/lib/db"
import { splats, photos } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const photoName = request.nextUrl.searchParams.get("photo_name")

  if (!photoName) {
    return NextResponse.json(
      { error: "photo_name is required" },
      { status: 400 }
    )
  }

  const result = await db
    .select()
    .from(splats)
    .where(eq(splats.photoName, photoName))
    .limit(1)

  if (result.length === 0) {
    return NextResponse.json({ status: "none" })
  }

  const row = {
    ...result[0],
    plyUrl: result[0].plyUrl?.replace(/\n/g, "") ?? null,
  }

  return NextResponse.json(row, {
    headers: {
      "Cache-Control":
        row.status === "ready"
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "no-cache",
    },
  })
}

export async function POST(request: NextRequest) {
  const { photoName } = await request.json()

  if (!photoName) {
    return NextResponse.json(
      { error: "photoName is required" },
      { status: 400 }
    )
  }

  // Check if already exists
  const existing = await db
    .select()
    .from(splats)
    .where(eq(splats.photoName, photoName))
    .limit(1)

  if (existing.length > 0 && existing[0].status !== "error") {
    return NextResponse.json(existing[0])
  }

  // Get the photo's full URL
  const photo = await db
    .select({ url: photos.url, name: photos.name })
    .from(photos)
    .where(eq(photos.name, photoName))
    .limit(1)

  if (photo.length === 0) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 })
  }

  // Upsert splat record as "processing"
  if (existing.length > 0) {
    await db
      .update(splats)
      .set({ status: "processing", errorMessage: null, updatedAt: new Date() })
      .where(eq(splats.photoName, photoName))
  } else {
    await db.insert(splats).values({
      photoName,
      status: "processing",
    })
  }

  // Return immediately — Modal runs in background via after()
  after(async () => {
    try {
      const modalUrl = process.env.MODAL_ENDPOINT_URL?.trim()
      if (!modalUrl) throw new Error("MODAL_ENDPOINT_URL not configured")

      const modalRes = await fetch(modalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: photo[0].url,
          photo_name: photo[0].name,
        }),
      })

      const modalData = await modalRes.json()

      if (modalData.status === "ready") {
        const splatUrl = process.env.MODAL_SPLAT_URL?.trim()
        const plyUrl = `${splatUrl}?photo_name=${encodeURIComponent(photo[0].name)}`

        await db
          .update(splats)
          .set({ status: "ready", plyUrl, updatedAt: new Date() })
          .where(eq(splats.photoName, photoName))
      } else {
        await db
          .update(splats)
          .set({
            status: "error",
            errorMessage: modalData.error || "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(splats.photoName, photoName))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      await db
        .update(splats)
        .set({ status: "error", errorMessage: msg, updatedAt: new Date() })
        .where(eq(splats.photoName, photoName))
    }
  })

  return NextResponse.json({ photoName, status: "processing" })
}
