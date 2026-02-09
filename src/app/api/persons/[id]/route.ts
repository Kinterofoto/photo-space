import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { persons } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const [updated] = await db
    .update(persons)
    .set({ name: body.name })
    .where(eq(persons.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  return NextResponse.json(updated)
}
