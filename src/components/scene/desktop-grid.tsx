"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Download } from "lucide-react"
import { useFaces } from "@/hooks/use-faces"
import { FaceOverlay } from "@/components/mobile/face-overlay"
import { useParticleDissolve } from "@/components/effects/particle-dissolve"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ManifestPhoto } from "@/types/photo"

interface DesktopGridProps {
  photos: ManifestPhoto[]
  showLandmarks: boolean
}

function GridPhoto({
  photo,
  index,
  showLandmarks,
  onClick,
}: {
  photo: ManifestPhoto
  index: number
  showLandmarks: boolean
  onClick: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: faces } = useFaces(showLandmarks && hovered ? photo.name : null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.unobserve(el)
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "group relative cursor-pointer break-inside-avoid overflow-hidden rounded-lg transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      style={{ transitionDelay: `${(index % 8) * 40}ms` }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={photo.thumbUrl}
        alt=""
        className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
        draggable={false}
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
      {/* Face overlay on hover */}
      {faces && faces.length > 0 && (
        <FaceOverlay faces={faces} visible={showLandmarks} />
      )}
    </div>
  )
}

/* ── Lightbox viewer ── */
function Lightbox({
  photos,
  index,
  showLandmarks,
  onClose,
  onNavigate,
}: {
  photos: ManifestPhoto[]
  index: number
  showLandmarks: boolean
  onClose: () => void
  onNavigate: (i: number) => void
}) {
  const photo = photos[index]
  const [hiRes, setHiRes] = useState<string | null>(null)
  const { data: faces } = useFaces(photo.name)
  const imgRef = useRef<HTMLImageElement>(null)
  const { trigger: triggerDissolve, canvasRef, isDissolving } = useParticleDissolve()

  useEffect(() => {
    setHiRes(null)
    const img = new Image()
    img.onload = () => setHiRes(photo.url)
    img.src = photo.url
  }, [photo.url])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1)
      if (e.key === "ArrowRight" && index < photos.length - 1) onNavigate(index + 1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [index, photos.length, onClose, onNavigate])

  const handleDownload = useCallback(async () => {
    if (imgRef.current) triggerDissolve(imgRef.current)
    try {
      const res = await fetch(photo.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = photo.name
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
    } catch {
      window.open(photo.url, "_blank")
    }
  }, [photo.url, photo.name, triggerDissolve])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Nav arrows */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
          className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
          className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 py-4">
        <span className="font-mono text-[11px] tabular-nums text-white/30">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload() }}
            className="flex h-8 items-center gap-1.5 rounded-full bg-white/5 px-3 font-mono text-[10px] lowercase tracking-wider text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
          >
            <Download className="h-3.5 w-3.5" />
            save
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Photo */}
      <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={hiRes || photo.thumbUrl}
          alt=""
          className="max-h-[85vh] max-w-[90vw] object-contain"
          crossOrigin="anonymous"
          draggable={false}
        />
        <canvas ref={canvasRef} className="pointer-events-none" />
        {faces && faces.length > 0 && (
          <FaceOverlay faces={faces} visible={showLandmarks} />
        )}
      </div>

      {/* File name */}
      <span className="absolute bottom-4 font-mono text-[10px] lowercase tracking-wider text-white/15">
        {photo.name}
      </span>
    </div>
  )
}

export function DesktopGrid({ photos, showLandmarks }: DesktopGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="columns-3 gap-2 p-2 xl:columns-4 2xl:columns-5">
        {photos.map((photo, i) => (
          <div key={photo.name} className="mb-2">
            <GridPhoto
              photo={photo}
              index={i}
              showLandmarks={showLandmarks}
              onClick={() => setLightboxIndex(i)}
            />
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          showLandmarks={showLandmarks}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  )
}
