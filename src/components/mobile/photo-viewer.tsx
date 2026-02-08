"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SUPABASE_URL, BUCKET } from "@/lib/constants"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ManifestPhoto } from "@/types/photo"

interface PhotoViewerProps {
  photo: ManifestPhoto | null
  onClose: () => void
}

export function PhotoViewer({ photo, onClose }: PhotoViewerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hiResLoaded, setHiResLoaded] = useState(false)
  const [hiResSrc, setHiResSrc] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const closingRef = useRef(false)

  // Animate in when photo changes
  useEffect(() => {
    if (photo) {
      closingRef.current = false
      setHiResLoaded(false)
      setHiResSrc(null)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })

      // Load hi-res
      const src = `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${photo.name}?width=1200&height=1200&resize=contain&quality=75`
      const img = new Image()
      img.onload = () => {
        setHiResSrc(src)
        setHiResLoaded(true)
      }
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
    }, 300)
  }, [onClose])

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
      // Fallback for iOS: open in new tab
      window.open(
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photo.name}`,
        "_blank"
      )
    } finally {
      setDownloading(false)
    }
  }, [photo, downloading])

  if (!photo) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col transition-all duration-300 ease-out",
        isVisible ? "bg-black/95 backdrop-blur-2xl" : "bg-transparent"
      )}
      onClick={handleClose}
    >
      {/* Top bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 pb-2 pt-[env(safe-area-inset-top,12px)] transition-all delay-75 duration-300",
          isVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-4 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="max-w-[60%] truncate font-mono text-[11px] lowercase tracking-wide text-white/30">
          {photo.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-8 w-8 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Photo */}
      <div
        className="flex flex-1 items-center justify-center px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={hiResSrc || photo.thumb}
          alt=""
          className={cn(
            "max-h-full max-w-full rounded-lg object-contain transition-all duration-300",
            isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0",
            hiResLoaded && "shadow-2xl"
          )}
        />
      </div>

      {/* Bottom bar */}
      <div
        className={cn(
          "flex items-center justify-center px-4 pb-[env(safe-area-inset-bottom,24px)] pt-4 transition-all delay-100 duration-300",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="h-11 rounded-full bg-white/10 px-8 text-[13px] font-normal lowercase tracking-wider text-white/80 backdrop-blur-sm hover:bg-white/20 active:scale-95 disabled:opacity-40"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {downloading ? "saving..." : "save"}
        </Button>
      </div>
    </div>
  )
}
