import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { faces, persons } from "@/lib/db/schema"
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
