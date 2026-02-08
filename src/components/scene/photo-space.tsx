"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense, useMemo, useCallback, useRef } from "react"
import { toast } from "sonner"
import { PhotoCard } from "./photo-card"
import { Particles } from "./particles"
import { CameraControls } from "./camera-controls"
import { useManifest } from "@/hooks/use-manifest"
import { GithubBadge } from "@/components/github-badge"
import { SPREAD, SUPABASE_URL, BUCKET } from "@/lib/constants"
import type { ProcessedPhoto } from "@/types/photo"

export function PhotoSpace() {
  const { photos: manifest } = useManifest()
  const downloadingRef = useRef(false)
  const isDragging = useRef(false)
  const pointerDownPos = useRef({ x: 0, y: 0 })

  // Compute random positions/rotations once when manifest loads
  const photos = useMemo<ProcessedPhoto[]>(
    () =>
      manifest.map((photo) => ({
        ...photo,
        position: [
          (Math.random() - 0.5) * SPREAD,
          (Math.random() - 0.5) * SPREAD,
          (Math.random() - 0.5) * SPREAD,
        ] as [number, number, number],
        rotation: [
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.15,
        ] as [number, number, number],
        size: 25 + Math.random() * 10,
        floatSpeed: 0.2 + Math.random() * 0.5,
        floatOffset: Math.random() * Math.PI * 2,
      })),
    [manifest]
  )

  // Download full-quality photo with throttle
  const handleDownload = useCallback(async (filename: string) => {
    if (downloadingRef.current) return
    downloadingRef.current = true

    try {
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
      toast("saved", {
        style: {
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          fontSize: "14px",
          letterSpacing: "2px",
          textTransform: "lowercase",
          boxShadow: "none",
        },
      })
    } catch (err) {
      console.error("Download failed:", err)
      toast.error("download failed")
    } finally {
      downloadingRef.current = false
    }
  }, [])

  return (
    <div
      className="h-screen w-screen bg-black"
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY }
        isDragging.current = false
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0) return
        const dx = e.clientX - pointerDownPos.current.x
        const dy = e.clientY - pointerDownPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > 4) {
          isDragging.current = true
        }
      }}
    >
      <div className="pointer-events-auto fixed right-4 top-4 z-10">
        <GithubBadge />
      </div>

      <Canvas
        camera={{ position: [0, 0, 150], fov: 60, near: 0.1, far: 5000 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["black"]} />
        <fogExp2 attach="fog" args={["black", 0.003]} />
        <ambientLight intensity={1.5} />

        <Suspense fallback={null}>
          {photos.map((photo) => (
            <PhotoCard
              key={photo.name}
              photo={photo}
              onDownload={handleDownload}
              isDragging={isDragging}
            />
          ))}
        </Suspense>

        <Particles />
        <CameraControls />
      </Canvas>
    </div>
  )
}
