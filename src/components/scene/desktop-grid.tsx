"use client"

import { useState, useEffect, useRef } from "react"
import { useFaces } from "@/hooks/use-faces"
import { FaceOverlay } from "@/components/mobile/face-overlay"
import { usePhotoSwipe } from "@/hooks/use-photoswipe"
import { Generate3DButton } from "@/components/generate-3d-button"
import { cn } from "@/lib/utils"
import type { ManifestPhoto } from "@/types/photo"

interface DesktopGridProps {
  photos: ManifestPhoto[]
  showLandmarks: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
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
  const ref = useRef<HTMLDivElement>(null)
  const { data: faces } = useFaces(showLandmarks && visible ? photo.name : null)

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
      data-pswp-thumb
      className={cn(
        "group relative cursor-pointer break-inside-avoid overflow-hidden rounded-lg transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      style={{ transitionDelay: `${(index % 8) * 40}ms` }}
      onClick={onClick}
    >
      <img
        src={photo.thumbUrl.replace("c_fill", "c_limit")}
        alt=""
        className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
        draggable={false}
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
      {/* Face overlay */}
      {faces && faces.length > 0 && (
        <FaceOverlay faces={faces} visible={showLandmarks} />
      )}
    </div>
  )
}

export function DesktopGrid({ photos, showLandmarks, hasNextPage, isFetchingNextPage, onLoadMore }: DesktopGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // PhotoSwipe lightbox
  const { open, currentPhotoName } = usePhotoSwipe(photos, "#desktop-photo-grid")

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      { rootMargin: "300px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  return (
    <>
      <div id="desktop-photo-grid" className="columns-3 gap-2 p-2 xl:columns-4 2xl:columns-5">
        {photos.map((photo, i) => (
          <div key={photo.name} className="mb-2">
            <GridPhoto
              photo={photo}
              index={i}
              showLandmarks={showLandmarks}
              onClick={() => open(i)}
            />
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* 3D button — floating over PhotoSwipe when open */}
      {currentPhotoName && (
        <div className="fixed bottom-6 right-6 z-[100000]">
          <Generate3DButton photoName={currentPhotoName} size="md" />
        </div>
      )}

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
        </div>
      )}
    </>
  )
}
