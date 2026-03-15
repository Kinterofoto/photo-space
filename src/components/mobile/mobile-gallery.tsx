"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import { useQueryClient } from "@tanstack/react-query"
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
import { hapticTap } from "@/lib/haptics"
import type { PersonWithFace } from "@/hooks/use-persons"
import type { ManifestPhoto } from "@/types/photo"

const Mobile3DScene = dynamic(
  () => import("./mobile-3d-scene").then((m) => m.Mobile3DScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
      </div>
    ),
  }
)

function mobileThumbUrl(thumbUrl: string): string {
  return thumbUrl.replace(/upload\/[^/]*/, "upload/c_limit,w_600,q_auto,f_auto")
}

function blurPlaceholderUrl(thumbUrl: string): string {
  return thumbUrl.replace(/upload\/[^/]*/, "upload/e_blur:2000,w_20,q_10,f_auto")
}

const EVENTS = ["all", "codebrew", "sheships"] as const

function ThumbPhoto({
  photo,
  index,
  batchIndex,
  visible,
  showLandmarks,
  onClick,
}: {
  photo: ManifestPhoto
  index: number
  batchIndex: number
  visible: boolean
  showLandmarks: boolean
  onClick: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const { data: faces } = useFaces(showLandmarks && visible ? photo.name : null)

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3

  return (
    <button
      data-index={index}
      data-pswp-thumb
      className={cn(
        "relative mb-[5px] block w-full break-inside-avoid overflow-hidden rounded-[10px]",
        "transition-all duration-500",
        "active:scale-[0.97] active:brightness-75",
        visible && loaded
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0"
      )}
      style={{
        aspectRatio,
        transitionDelay: visible ? `${(batchIndex % 6) * 60}ms` : "0ms",
      }}
      onClick={onClick}
    >
      {visible && (
        <>
          <img
            src={blurPlaceholderUrl(photo.thumbUrl)}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              loaded ? "opacity-0" : "opacity-100"
            )}
            draggable={false}
          />
          <img
            src={mobileThumbUrl(photo.thumbUrl)}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              loaded ? "opacity-100" : "opacity-0"
            )}
            draggable={false}
            onLoad={() => setLoaded(true)}
          />
          {faces && faces.length > 0 && (
            <FaceOverlay faces={faces} visible={showLandmarks} />
          )}
        </>
      )}
    </button>
  )
}

function SkeletonGrid() {
  const ratios = [3 / 4, 4 / 3, 3 / 4, 4 / 3, 4 / 3, 3 / 4, 3 / 4, 4 / 3]
  return (
    <div className="columns-2 gap-[5px] p-[5px] sm:columns-3 lg:columns-4">
      {ratios.map((ratio, i) => (
        <div
          key={i}
          className="mb-[5px] animate-pulse break-inside-avoid rounded-[10px] bg-white/[0.04]"
          style={{ aspectRatio: ratio }}
        />
      ))}
    </div>
  )
}

export function MobileGallery() {
  const { event: selectedEvent, personId: selectedPersonId, viewMode, setEvent: setSelectedEvent, setPerson: setSelectedPersonId, setViewMode } = useFilterParams("grid")
  const { photos, loading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfinitePhotos(selectedEvent, selectedPersonId)
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const queryClient = useQueryClient()

  const is3D = viewMode === "3d"

  // Face filtering
  const [namingPerson, setNamingPerson] = useState<PersonWithFace | null>(null)
  const [showLandmarks, setShowLandmarks] = useState(true)

  // People strip collapse on scroll (grid mode only)
  const [stripVisible, setStripVisible] = useState(true)
  const lastScrollY = useRef(0)

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  // PhotoSwipe lightbox
  const { open, currentPhotoName, topBarEl } = usePhotoSwipe(photos, "#mobile-photo-grid", showLandmarks)

  const namePerson = useNamePerson()

  // Track batch boundaries for stagger delay reset
  const batchStart = prevCountRef.current
  useEffect(() => {
    prevCountRef.current = photos.length
  }, [photos.length])

  // Observe photo items for staggered fade-in
  useEffect(() => {
    if (is3D) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index
            )
            setVisibleItems((prev) => {
              if (prev.has(index)) return prev
              return new Set(prev).add(index)
            })
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: "200px", threshold: 0.1 }
    )

    gridRef.current?.querySelectorAll<HTMLElement>("[data-index]").forEach(
      (el) => {
        const index = Number(el.dataset.index)
        if (!visibleItems.has(index)) observer.observe(el)
      }
    )

    return () => observer.disconnect()
  }, [photos, is3D])

  // Reset visible items + scroll to top when filters change
  useEffect(() => {
    setVisibleItems(new Set())
    prevCountRef.current = 0
    if (!is3D) window.scrollTo({ top: 0, behavior: "smooth" })
  }, [selectedEvent, selectedPersonId, is3D])

  // Collapse people strip on scroll down, show on scroll up (grid mode)
  useEffect(() => {
    if (is3D) return
    function onScroll() {
      const y = window.scrollY
      if (y > lastScrollY.current + 10) setStripVisible(false)
      else if (y < lastScrollY.current - 10) setStripVisible(true)
      lastScrollY.current = y
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [is3D])

  // Pull-to-refresh handlers (grid mode only)
  useEffect(() => {
    if (is3D) return
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY
        isPulling.current = true
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!isPulling.current || refreshing) return
      const dy = e.touches[0].clientY - touchStartY.current
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.4, 80))
      }
    }
    function onTouchEnd() {
      if (!isPulling.current) return
      isPulling.current = false
      if (pullDistance > 60 && !refreshing) {
        setRefreshing(true)
        setPullDistance(40)
        queryClient.invalidateQueries().then(() => {
          setRefreshing(false)
          setPullDistance(0)
        })
      } else {
        setPullDistance(0)
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [pullDistance, refreshing, queryClient, is3D])

  // Infinite scroll: observe sentinel to load next page (grid mode)
  useEffect(() => {
    if (is3D) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: "1200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, is3D])

  const handleSelectEvent = useCallback(
    (ev: string) => {
      hapticTap()
      setSelectedEvent(ev === "all" ? null : ev)
    },
    [setSelectedEvent]
  )

  return (
    <div className={cn("min-h-screen bg-black", is3D && "h-screen overflow-hidden")}>
      {/* Pull-to-refresh indicator (grid only) */}
      {!is3D && pullDistance > 0 && (
        <div
          className="flex items-center justify-center"
          style={{ height: pullDistance }}
        >
          <div
            className={cn(
              "h-5 w-5 rounded-full border-[1.5px] border-white/10 border-t-white/50",
              refreshing && "animate-spin"
            )}
            style={!refreshing ? { transform: `rotate(${pullDistance * 4}deg)` } : undefined}
          />
        </div>
      )}

      {/* Header */}
      <header
        className={cn(
          "z-40 border-b border-white/[0.06] backdrop-blur-xl",
          is3D ? "fixed left-0 right-0 top-0 bg-black/50" : "sticky top-0 bg-black/70"
        )}
      >
        <div className="mx-auto max-w-5xl px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <h1 className="shrink-0 font-mono text-[11px] font-light lowercase tracking-[5px] text-white/40 sm:text-xs sm:tracking-[6px]">
              photo space
            </h1>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/50 p-0.5 backdrop-blur-xl">
              <button
                onClick={() => { hapticTap(); setViewMode("3d") }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-mono text-[10px] lowercase tracking-wider transition-all",
                  is3D
                    ? "bg-white/10 text-white/60"
                    : "text-white/25 active:bg-white/5"
                )}
              >
                3d
              </button>
              <button
                onClick={() => { hapticTap(); setViewMode("grid") }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-mono text-[10px] lowercase tracking-wider transition-all",
                  !is3D
                    ? "bg-white/10 text-white/60"
                    : "text-white/25 active:bg-white/5"
                )}
              >
                grid
              </button>
            </div>

            {/* Event filter */}
            <div className="flex items-center gap-1 sm:gap-2">
              {EVENTS.map((ev) => (
                <button
                  key={ev}
                  onClick={() => handleSelectEvent(ev)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-[10px] lowercase tracking-wider transition-all sm:px-4 sm:py-1.5 sm:text-[11px]",
                    (ev === "all" && !selectedEvent) || selectedEvent === ev
                      ? "bg-white/10 text-white/60"
                      : "text-white/25 hover:bg-white/[0.03] active:bg-white/5"
                  )}
                >
                  {ev}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {!is3D && (
                <button
                  onClick={() => setShowLandmarks((v) => !v)}
                  className={cn(
                    "rounded-full border p-1.5 transition-all sm:p-2",
                    showLandmarks
                      ? "border-white/20 bg-white/15 text-white/70"
                      : "border-white/[0.06] text-white/25 hover:bg-white/[0.03] active:bg-white/5"
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
              )}
              <GithubBadge />
            </div>
          </div>
        </div>

        {/* People strip */}
        <div
          className={cn(
            "mx-auto max-w-5xl overflow-hidden transition-all duration-300",
            is3D
              ? "max-h-[100px] opacity-100"
              : stripVisible ? "max-h-[100px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <PeopleStrip
            selectedPersonId={selectedPersonId}
            onSelectPerson={(id) => {
              hapticTap()
              setSelectedPersonId(id)
            }}
            onTapUnnamed={setNamingPerson}
            event={selectedEvent}
          />
        </div>
      </header>

      {/* 3D View */}
      {is3D && (
        <Mobile3DScene event={selectedEvent} personId={selectedPersonId} />
      )}

      {/* Grid View */}
      {!is3D && (
        <>
          {/* Skeleton loading */}
          {loading && (
            <div className="mx-auto max-w-5xl">
              <SkeletonGrid />
            </div>
          )}

          {/* Photo Grid — responsive columns */}
          {!loading && (
            <div ref={gridRef} id="mobile-photo-grid" className="mx-auto max-w-5xl columns-2 gap-[5px] p-[5px] sm:columns-3 lg:columns-4">
              {photos.map((photo, index) => (
                <ThumbPhoto
                  key={photo.name}
                  photo={photo}
                  index={index}
                  batchIndex={index >= batchStart ? index - batchStart : 0}
                  visible={visibleItems.has(index)}
                  showLandmarks={showLandmarks}
                  onClick={() => {
                    hapticTap()
                    open(index)
                  }}
                />
              ))}
            </div>
          )}

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
            <div className="flex items-center justify-center py-8 pb-[max(env(safe-area-inset-bottom),32px)]">
              <span className="font-mono text-[10px] lowercase tracking-[3px] text-white/20">
                {photos.length} photos
              </span>
            </div>
          )}

          {/* 3D button — portaled into PhotoSwipe top bar */}
          {currentPhotoName && topBarEl && createPortal(
            <Generate3DButton photoName={currentPhotoName} size="md" />,
            topBarEl
          )}
        </>
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
