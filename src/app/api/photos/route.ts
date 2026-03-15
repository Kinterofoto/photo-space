import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { photos, faces, persons } from "@/lib/db/schema"
import { eq, asc, and, sql } from "drizzle-orm"

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
}

const photoFields = {
  id: photos.id,
  name: photos.name,
  url: photos.url,
  thumbUrl: photos.thumbUrl,
  width: photos.width,
  height: photos.height,
  event: photos.event,
}

export async function GET(request: NextRequest) {
  let personId = request.nextUrl.searchParams.get("person_id")
  const event = request.nextUrl.searchParams.get("event")
  const limitParam = request.nextUrl.searchParams.get("limit")
  const offsetParam = request.nextUrl.searchParams.get("offset")

  // Resolve short person ID prefix to full UUID
  if (personId && personId.length < 36) {
    const match = await db
      .select({ id: persons.id })
      .from(persons)
      .where(sql`${persons.id}::text LIKE ${personId + "%"}`)
      .limit(1)
    if (match.length === 0) {
      return NextResponse.json([], { headers: CACHE_HEADERS })
    }
    personId = match[0].id
  }

  // Legacy: return photo names only (used by 3D mode highlighting)
  if (personId && !limitParam) {
    const result = await db
      .selectDistinct({ photoName: faces.photoName })
      .from(faces)
      .where(eq(faces.personId, personId))

    return NextResponse.json(result.map((r) => r.photoName), {
      headers: CACHE_HEADERS,
    })
  }

  const limit = limitParam ? Number(limitParam) : null
  const offset = offsetParam ? Number(offsetParam) : 0

  if (personId) {
    // Person filter: JOIN faces to get full photo objects
    let query = db
      .selectDistinct(photoFields)
      .from(photos)
      .innerJoin(faces, eq(faces.photoName, photos.name))
      .where(
        and(
          eq(faces.personId, personId),
          event ? eq(photos.event, event) : undefined
        )
      )
      .orderBy(asc(photos.name))

    if (limit) {
      query = query.limit(limit).offset(offset) as typeof query
    }

    const result = await query
    return NextResponse.json(result, { headers: CACHE_HEADERS })
  }

  // Default: return photos with optional event filter and pagination
  let query = db
    .select(photoFields)
    .from(photos)
    .where(event ? eq(photos.event, event) : undefined)
    .orderBy(asc(photos.name))

  if (limit) {
    query = query.limit(limit).offset(offset) as typeof query
  }

  const result = await query
  return NextResponse.json(result, { headers: CACHE_HEADERS })
}
