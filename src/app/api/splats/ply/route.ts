import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { splats } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const photoName = request.nextUrl.searchParams.get("photo_name")

  if (!photoName) {
    return NextResponse.json({ error: "photo_name is required" }, { status: 400 })
  }

  const result = await db
    .select({ plyUrl: splats.plyUrl, status: splats.status })
    .from(splats)
    .where(eq(splats.photoName, photoName))
    .limit(1)

  if (result.length === 0 || result[0].status !== "ready" || !result[0].plyUrl) {
    return NextResponse.json({ error: "PLY not found" }, { status: 404 })
  }

  // Proxy the PLY file from Modal to avoid CORS
  const plyRes = await fetch(result[0].plyUrl)
  if (!plyRes.ok || !plyRes.body) {
    return NextResponse.json({ error: "Failed to fetch PLY" }, { status: 502 })
  }

  return new NextResponse(plyRes.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
