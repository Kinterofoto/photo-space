import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { persons, faces, photos } from "@/lib/db/schema"
import { desc, eq, asc, sql, and, inArray } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get("event")

  let allPersons

  if (event) {
    // Only persons that appear in photos for this event
    const personIds = await db
      .selectDistinct({ personId: faces.personId })
      .from(faces)
      .innerJoin(photos, eq(photos.name, faces.photoName))
      .where(and(eq(photos.event, event), sql`${faces.personId} IS NOT NULL`))

    const ids = personIds.map((r) => r.personId).filter(Boolean) as string[]
    if (ids.length === 0) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      })
    }

    allPersons = await db
      .select()
      .from(persons)
      .where(inArray(persons.id, ids))
      .orderBy(
        asc(sql`CASE WHEN ${persons.name} IS NOT NULL THEN 0 ELSE 1 END`),
        asc(persons.name),
        desc(persons.faceCount)
      )
  } else {
    // All persons
    allPersons = await db
      .select()
      .from(persons)
      .orderBy(
        asc(sql`CASE WHEN ${persons.name} IS NOT NULL THEN 0 ELSE 1 END`),
        asc(persons.name),
        desc(persons.faceCount)
      )
  }

  // Get one representative face per person (with thumbnail)
  const personsWithFaces = await Promise.all(
    allPersons.map(async (person) => {
      const [face] = await db
        .select({
          photoName: faces.photoName,
          thumbnail: faces.thumbnail,
        })
        .from(faces)
        .where(eq(faces.personId, person.id))
        .limit(1)

      return { ...person, representativeFace: face || null }
    })
  )

  return NextResponse.json(personsWithFaces, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  })
}
