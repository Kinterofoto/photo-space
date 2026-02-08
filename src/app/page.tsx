"use client"

import dynamic from "next/dynamic"
import { MobileGate } from "@/components/mobile-gate"

const PhotoSpace = dynamic(
  () =>
    import("@/components/scene/photo-space").then((mod) => ({
      default: mod.PhotoSpace,
    })),
  { ssr: false }
)

export default function Home() {
  return (
    <MobileGate>
      <PhotoSpace />
    </MobileGate>
  )
}
