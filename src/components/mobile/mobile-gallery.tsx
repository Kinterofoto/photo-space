"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useManifest } from "@/hooks/use-manifest"
import { PhotoViewer } from "./photo-viewer"
import { GithubBadge } from "@/components/github-badge"
import { cn } from "@/lib/utils"

export function MobileGallery() {
  const { photos, loading } = useManifest()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Intersection observer for staggered fade-in
  const itemRef = useCallback((node: HTMLElement | null) => {
    if (!node) return
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const index = Number(
                (entry.target as HTMLElement).dataset.index
              )
              setVisibleItems((prev) => new Set(prev).add(index))
              observerRef.current?.unobserve(entry.target)
            }
          })
        },
        { rootMargin: "50px", threshold: 0.1 }
      )
    }
    observerRef.current.observe(node)
  }, [])

  // Cleanup observer
  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  // Lock body scroll when viewer is open
  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [selectedIndex])

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
          <h1 className="font-mono text-[11px] font-light lowercase tracking-[5px] text-white/40">
            photo space
          </h1>
          <GithubBadge />
        </div>
      </header>

      {/* Photo Grid */}
      <div className="columns-2 gap-[5px] p-[5px]">
        {photos.map((photo, index) => (
          <button
            key={photo.name}
            ref={itemRef}
            data-index={index}
            className={cn(
              "mb-[5px] block w-full break-inside-avoid overflow-hidden rounded-[10px] transition-all duration-500",
              "active:scale-[0.97] active:brightness-75",
              visibleItems.has(index)
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0"
            )}
            style={{
              transitionDelay: visibleItems.has(index)
                ? `${(index % 6) * 60}ms`
                : "0ms",
            }}
            onClick={() => setSelectedIndex(index)}
          >
            <img
              src={photo.thumb}
              alt=""
              className="w-full"
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Photo count */}
      {!loading && photos.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] lowercase tracking-[3px] text-white/20">
            {photos.length} photos
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
        </div>
      )}

      {/* Photo Viewer */}
      <PhotoViewer
        photos={photos}
        currentIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
      />
    </div>
  )
}
