"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SUPABASE_URL, BUCKET } from "@/lib/constants"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ManifestPhoto } from "@/types/photo"

interface PhotoViewerProps {
  photos: ManifestPhoto[]
  currentIndex: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

const SWIPE_THRESHOLD = 60

export function PhotoViewer({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: PhotoViewerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hiResSrc, setHiResSrc] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const closingRef = useRef(false)

  // Swipe state
  const touchStart = useRef({ x: 0, y: 0 })
  const [dragX, setDragX] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const photo = currentIndex !== null ? photos[currentIndex] : null
  const hasPrev = currentIndex !== null && currentIndex > 0
  const hasNext = currentIndex !== null && currentIndex < photos.length - 1

  // Animate in when photo changes
  useEffect(() => {
    if (photo) {
      closingRef.current = false
      setHiResSrc(null)
      setDragX(0)
      setSwiping(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })

      // Load hi-res
      const src = `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${photo.name}?width=1200&height=1200&resize=contain&quality=75`
      const img = new Image()
      img.onload = () => setHiResSrc(src)
      img.src = src
    }
  }, [photo])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      setIsVisible(false)
    }, 250)
  }, [onClose])

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= photos.length) return
      setDragX(0)
      setSwiping(false)
      onNavigate(index)
    },
    [photos.length, onNavigate]
  )

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
    setSwiping(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStart.current.x
    setDragX(dx)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      if (dragX > 0 && hasPrev) {
        goTo(currentIndex! - 1)
        return
      }
      if (dragX < 0 && hasNext) {
        goTo(currentIndex! + 1)
        return
      }
    }
    setDragX(0)
    setSwiping(false)
  }, [dragX, hasPrev, hasNext, currentIndex, goTo])

  const handleDownload = useCallback(async () => {
    if (!photo || downloading) return
    setDownloading(true)

    try {
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photo.name}`
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = photo.name
      a.click()
      URL.revokeObjectURL(blobUrl)
      toast("saved", {
        style: {
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.8)",
          fontSize: "13px",
          letterSpacing: "1px",
        },
      })
    } catch {
      window.open(
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photo.name}`,
        "_blank"
      )
    } finally {
      setDownloading(false)
    }
  }, [photo, downloading])

  if (!photo || currentIndex === null) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col transition-all duration-250 ease-out",
        isVisible ? "bg-black" : "bg-transparent pointer-events-none"
      )}
    >
      {/* Top bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 pb-2 pt-[env(safe-area-inset-top,12px)] transition-all delay-75 duration-300",
          isVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-4 opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-9 w-9 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>

        <span className="font-mono text-[11px] tabular-nums text-white/30">
          {currentIndex + 1} / {photos.length}
        </span>

        <Button
          onClick={handleDownload}
          disabled={downloading}
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Download className="h-5 w-5" />
        </Button>
      </div>

      {/* Photo with swipe */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev / Next arrows */}
        {hasPrev && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 active:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 active:bg-white/10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <img
          src={hiResSrc || photo.thumb}
          alt=""
          className={cn(
            "max-h-full max-w-full object-contain",
            isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0",
            !swiping && "transition-all duration-250"
          )}
          style={{
            transform: `translateX(${dragX}px) scale(${isVisible ? 1 : 0.95})`,
            opacity: isVisible
              ? 1 - Math.min(Math.abs(dragX) / 400, 0.4)
              : 0,
          }}
          draggable={false}
        />
      </div>

      {/* Bottom bar — big download button */}
      <div
        className={cn(
          "flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom,24px)] pt-3 transition-all delay-100 duration-300",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
      >
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="h-12 w-full max-w-xs rounded-full bg-white text-sm font-medium lowercase tracking-wider text-black active:scale-[0.97] disabled:opacity-40"
        >
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "saving..." : "save photo"}
        </Button>
        <span className="max-w-[80%] truncate font-mono text-[10px] lowercase tracking-wide text-white/20">
          {photo.name}
        </span>
      </div>
    </div>
  )
}
