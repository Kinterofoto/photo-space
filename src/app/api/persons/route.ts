import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { persons, faces } from "@/lib/db/schema"
import { desc, eq, asc, sql } from "drizzle-orm"

export async function GET() {
  // Named persons first (alphabetical), then unnamed (by face count desc)
  const allPersons = await db
    .select()
    .from(persons)
    .orderBy(
      asc(sql`CASE WHEN ${persons.name} IS NOT NULL THEN 0 ELSE 1 END`),
      asc(persons.name),
      desc(persons.faceCount)
    )

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
