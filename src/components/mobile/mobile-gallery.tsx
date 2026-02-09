"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useManifest } from "@/hooks/use-manifest"
import { useQuery } from "@tanstack/react-query"
import { PhotoViewer } from "./photo-viewer"
import { PeopleStrip } from "./people-strip"
import { PersonNameDialog } from "./person-name-dialog"
import { GithubBadge } from "@/components/github-badge"
import { useNamePerson } from "@/hooks/use-name-person"
import { cn } from "@/lib/utils"
import type { PersonWithFace } from "@/hooks/use-persons"

export function MobileGallery() {
  const { photos, loading } = useManifest()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)

  // Face filtering
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [namingPerson, setNamingPerson] = useState<PersonWithFace | null>(null)
  const [showLandmarks, setShowLandmarks] = useState(true)

  const namePerson = useNamePerson()

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
    retry: 2,
  })

  // Filter photos by person
  const filteredPhotos = useMemo(() => {
    if (!selectedPersonId || !personPhotoNames) return photos
    const nameSet = new Set(personPhotoNames)
    return photos.filter((p) => nameSet.has(p.name))
  }, [photos, selectedPersonId, personPhotoNames])

  // Observe photo items for staggered fade-in; re-run when filter changes
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
  }, [filteredPhotos])

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

        {/* People strip */}
        <PeopleStrip
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          onTapUnnamed={setNamingPerson}
        />
      </header>

      {/* Photo Grid */}
      <div ref={gridRef} className="columns-2 gap-[5px] p-[5px]">
        {filteredPhotos.map((photo, index) => (
          <button
            key={photo.name}
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
              src={photo.thumbUrl}
              alt=""
              className="w-full"
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Photo count */}
      {!loading && filteredPhotos.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] lowercase tracking-[3px] text-white/20">
            {filteredPhotos.length} photos
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
        photos={filteredPhotos}
        currentIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
        showLandmarks={showLandmarks}
      />

      {/* Person naming dialog */}
      <PersonNameDialog
        person={namingPerson}
        onSubmit={(id, name) => namePerson.mutate({ id, name })}
        onClose={() => setNamingPerson(null)}
      />
    </div>
  )
}
