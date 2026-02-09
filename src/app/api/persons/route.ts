import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { persons, faces } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export async function GET() {
  const allPersons = await db
    .select()
    .from(persons)
    .orderBy(desc(persons.faceCount))

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

  return NextResponse.json(personsWithFaces)
}
