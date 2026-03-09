import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { photos, faces } from "@/lib/db/schema"
import { eq, asc, and } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("person_id")
  const event = request.nextUrl.searchParams.get("event")

  if (personId) {
    // Filter: photos containing a specific person
    const result = await db
      .selectDistinct({ photoName: faces.photoName })
      .from(faces)
      .where(eq(faces.personId, personId))

    return NextResponse.json(result.map((r) => r.photoName), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    })
  }

  // Default: return all photos, optionally filtered by event
  const conditions = event ? eq(photos.event, event) : undefined

  const allPhotos = await db
    .select({
      id: photos.id,
      name: photos.name,
      url: photos.url,
      thumbUrl: photos.thumbUrl,
      width: photos.width,
      height: photos.height,
      event: photos.event,
    })
    .from(photos)
    .where(conditions)
    .orderBy(asc(photos.name))

  return NextResponse.json(allPhotos, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  })
}
