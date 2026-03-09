"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useInfinitePhotos } from "@/hooks/use-infinite-photos"
import { useFilterParams } from "@/hooks/use-filter-params"
import { usePhotoSwipe } from "@/hooks/use-photoswipe"
import { Generate3DButton } from "@/components/generate-3d-button"
import { PeopleStrip } from "./people-strip"
import { PersonNameDialog } from "./person-name-dialog"
import { GithubBadge } from "@/components/github-badge"
import { useNamePerson } from "@/hooks/use-name-person"
import { useFaces } from "@/hooks/use-faces"
import { FaceOverlay } from "./face-overlay"
import { cn } from "@/lib/utils"
import type { PersonWithFace } from "@/hooks/use-persons"
import type { ManifestPhoto } from "@/types/photo"

const EVENTS = ["all", "codebrew", "sheships"] as const

function ThumbPhoto({
  photo,
  index,
  visible,
  showLandmarks,
  onClick,
}: {
  photo: ManifestPhoto
  index: number
  visible: boolean
  showLandmarks: boolean
  onClick: () => void
}) {
  const { data: faces } = useFaces(showLandmarks && visible ? photo.name : null)

  return (
    <button
      data-index={index}
      data-pswp-thumb
      className={cn(
        "relative mb-[5px] block w-full break-inside-avoid overflow-hidden rounded-[10px] transition-all duration-500",
        "active:scale-[0.97] active:brightness-75",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0"
      )}
      style={{
        transitionDelay: visible ? `${(index % 6) * 60}ms` : "0ms",
      }}
      onClick={onClick}
    >
      <img
        src={photo.thumbUrl.replace("c_fill", "c_limit")}
        alt=""
        className="w-full"
        draggable={false}
      />
      {faces && faces.length > 0 && (
        <FaceOverlay faces={faces} visible={showLandmarks} />
      )}
    </button>
  )
}

export function MobileGallery() {
  const { event: selectedEvent, personId: selectedPersonId, setEvent: setSelectedEvent, setPerson: setSelectedPersonId } = useFilterParams()
  const { photos, loading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfinitePhotos(selectedEvent, selectedPersonId)
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Face filtering
  const [namingPerson, setNamingPerson] = useState<PersonWithFace | null>(null)
  const [showLandmarks, setShowLandmarks] = useState(true)

  // PhotoSwipe lightbox
  const { open, currentPhotoName } = usePhotoSwipe(photos, "#mobile-photo-grid", showLandmarks)

  const namePerson = useNamePerson()

  // Observe photo items for staggered fade-in; re-run when photos change
  useEffect(() => {
    setVisibleItems(new Set())

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index
            )
            setVisibleItems((prev) => new Set(prev).add(index))
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: "50px", threshold: 0.1 }
    )

    gridRef.current?.querySelectorAll<HTMLElement>("[data-index]").forEach(
      (el) => observer.observe(el)
    )

    return () => observer.disconnect()
  }, [photos])

  // Infinite scroll: observe sentinel to load next page
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: "300px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleSelectEvent = useCallback(
    (ev: string) => {
      setSelectedEvent(ev === "all" ? null : ev)
    },
    [setSelectedEvent]
  )

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
          <h1 className="font-mono text-[11px] font-light lowercase tracking-[5px] text-white/40">
            photo space
          </h1>
          <div className="flex items-center gap-2">
            {/* Landmark scan toggle */}
            <button
              onClick={() => setShowLandmarks((v) => !v)}
              className={cn(
                "rounded-full border p-1.5 transition-all",
                showLandmarks
                  ? "border-white/20 bg-white/15 text-white/70"
                  : "border-white/[0.06] text-white/25 active:bg-white/5"
              )}
              title="Toggle face scan overlay"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M2 7V2h5M17 2h5v5M2 17v5h5M17 22h5v-5" />
                <circle cx="12" cy="10" r="3" />
                <path d="M12 13c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3z" />
              </svg>
            </button>
            <GithubBadge />
          </div>
        </div>

        {/* Event filter */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {EVENTS.map((ev) => (
            <button
              key={ev}
              onClick={() => handleSelectEvent(ev)}
              className={cn(
                "rounded-full px-3 py-1 font-mono text-[10px] lowercase tracking-wider transition-all",
                (ev === "all" && !selectedEvent) || selectedEvent === ev
                  ? "bg-white/10 text-white/60"
                  : "text-white/25 active:bg-white/5"
              )}
            >
              {ev}
            </button>
          ))}
        </div>

        {/* People strip */}
        <PeopleStrip
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          onTapUnnamed={setNamingPerson}
        />
      </header>

      {/* Photo Grid */}
      <div ref={gridRef} id="mobile-photo-grid" className="columns-2 gap-[5px] p-[5px]">
        {photos.map((photo, index) => (
          <ThumbPhoto
            key={photo.name}
            photo={photo}
            index={index}
            visible={visibleItems.has(index)}
            showLandmarks={showLandmarks}
            onClick={() => open(index)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading more */}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
        </div>
      )}

      {/* Photo count */}
      {!loading && !hasNextPage && photos.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] lowercase tracking-[3px] text-white/20">
            {photos.length} photos
          </span>
        </div>
      )}

      {/* Initial loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
        </div>
      )}

      {/* 3D button — floating over PhotoSwipe when open */}
      {currentPhotoName && (
        <div className="fixed bottom-6 right-4 z-[100000]">
          <Generate3DButton photoName={currentPhotoName} size="md" />
        </div>
      )}

      {/* Person naming dialog */}
      <PersonNameDialog
        person={namingPerson}
        onSubmit={(id, name) => namePerson.mutate({ id, name })}
        onClose={() => setNamingPerson(null)}
      />
    </div>
  )
}
