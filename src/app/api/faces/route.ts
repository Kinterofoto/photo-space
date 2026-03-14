import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { faces, persons } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const photoName = request.nextUrl.searchParams.get("photo_name")

  if (!photoName) {
    return NextResponse.json(
      { error: "photo_name is required" },
      { status: 400 }
    )
  }

  const result = await db
    .select({
      id: faces.id,
      photoName: faces.photoName,
      personId: faces.personId,
      landmarks: faces.landmarks,
      boxX: faces.boxX,
      boxY: faces.boxY,
      boxW: faces.boxW,
      boxH: faces.boxH,
      personName: persons.name,
    })
    .from(faces)
    .leftJoin(persons, eq(faces.personId, persons.id))
    .where(eq(faces.photoName, photoName))

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  })
}

// PATCH: update face assignment (dev debug)
export async function PATCH(request: NextRequest) {
  const { faceId, personId, newPersonName } = await request.json()

  if (!faceId) {
    return NextResponse.json({ error: "faceId is required" }, { status: 400 })
  }

  // newPersonName → create new person, assign face to it
  // personId = null → untag
  // personId = string → reassign
  let targetPersonId = personId

  if (newPersonName) {
    const [created] = await db
      .insert(persons)
      .values({ name: newPersonName, faceCount: 0 })
      .returning({ id: persons.id })
    targetPersonId = created.id
  }

  await db
    .update(faces)
    .set({ personId: targetPersonId ?? null })
    .where(eq(faces.id, faceId))

  // Update face_count on affected persons
  if (targetPersonId) {
    await db
      .update(persons)
      .set({ faceCount: sql`(SELECT COUNT(*) FROM faces WHERE faces.person_id = ${persons.id})` })
      .where(eq(persons.id, targetPersonId))
  }

  return NextResponse.json({ ok: true, personId: targetPersonId })
}
