"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense, useMemo, useCallback, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { PhotoCard } from "./photo-card"
import { Particles } from "./particles"
import { CameraControls } from "./camera-controls"
import { PeopleBar } from "./people-bar"
import { DesktopGrid } from "./desktop-grid"
import { useManifest } from "@/hooks/use-manifest"
import { GithubBadge } from "@/components/github-badge"
import { cn } from "@/lib/utils"
import { SPREAD } from "@/lib/constants"
import type { ProcessedPhoto } from "@/types/photo"

type ViewMode = "3d" | "grid"

export function PhotoSpace() {
  const { photos: manifest } = useManifest()
  const downloadingRef = useRef(false)
  const isDragging = useRef(false)
  const pointerDownPos = useRef({ x: 0, y: 0 })
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("3d")
  const [showLandmarks, setShowLandmarks] = useState(false)

  // Fetch photo names for selected person
  const { data: personPhotoNames } = useQuery({
    queryKey: ["person-photos", selectedPersonId],
    queryFn: async () => {
      const res = await fetch(
        `/api/photos?person_id=${encodeURIComponent(selectedPersonId!)}`
      )
      if (!res.ok) throw new Error("Failed to fetch photos")
      return res.json() as Promise<string[]>
    },
    enabled: !!selectedPersonId,
  })

  const highlightedSet = useMemo(() => {
    if (!selectedPersonId || !personPhotoNames) return null
    return new Set(personPhotoNames)
  }, [selectedPersonId, personPhotoNames])

  // Filtered photos for grid mode
  const filteredManifest = useMemo(() => {
    if (!highlightedSet) return manifest
    return manifest.filter((p) => highlightedSet.has(p.name))
  }, [manifest, highlightedSet])

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

    const photo = manifest.find((p) => p.name === filename)
    if (!photo) return

    try {
      const res = await fetch(photo.url)
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
  }, [manifest])

  return (
    <div
      className={cn(
        "bg-black",
        viewMode === "3d" ? "h-screen w-screen overflow-hidden" : "min-h-screen w-screen"
      )}
      onPointerDown={viewMode === "3d" ? (e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY }
        isDragging.current = false
      } : undefined}
      onPointerMove={viewMode === "3d" ? (e) => {
        if (e.buttons === 0) return
        const dx = e.clientX - pointerDownPos.current.x
        const dy = e.clientY - pointerDownPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > 4) {
          isDragging.current = true
        }
      } : undefined}
    >
      {/* Top bar */}
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex items-center justify-between px-5 py-4">
        {/* View mode toggle */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/50 p-1 backdrop-blur-xl">
          <button
            onClick={() => setViewMode("3d")}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[10px] lowercase tracking-wider transition-all",
              viewMode === "3d"
                ? "bg-white/10 text-white/60"
                : "text-white/25 hover:text-white/40"
            )}
          >
            3d
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[10px] lowercase tracking-wider transition-all",
              viewMode === "grid"
                ? "bg-white/10 text-white/60"
                : "text-white/25 hover:text-white/40"
            )}
          >
            grid
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Landmark scan toggle */}
          <button
            onClick={() => setShowLandmarks((v) => !v)}
            className={cn(
              "rounded-full border p-2 transition-all",
              showLandmarks
                ? "border-white/15 bg-white/10 text-white/50"
                : "border-white/[0.06] bg-black/50 text-white/20 hover:text-white/40 backdrop-blur-xl"
            )}
            title="Toggle face scan overlay"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M2 7V2h5M17 2h5v5M2 17v5h5M17 22h5v-5" />
              <circle cx="12" cy="10" r="3" />
              <path d="M12 13c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3z" />
            </svg>
          </button>
          <GithubBadge />
        </div>
      </div>

      {/* 3D View */}
      {viewMode === "3d" && (
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
                dimmed={highlightedSet !== null && !highlightedSet.has(photo.name)}
              />
            ))}
          </Suspense>

          <Particles />
          <CameraControls />
        </Canvas>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="pt-16">
          <DesktopGrid photos={filteredManifest} showLandmarks={showLandmarks} />
          {filteredManifest.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[10px] lowercase tracking-[3px] text-white/20">
                {filteredManifest.length} photos
              </span>
            </div>
          )}
        </div>
      )}

      <PeopleBar
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
    </div>
  )
}
