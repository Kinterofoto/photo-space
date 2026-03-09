"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ManifestPhoto } from "@/types/photo"

const PAGE_SIZE = 30

export function useInfinitePhotos(
  event: string | null,
  personId: string | null
) {
  const [page, setPage] = useState(1)

  // Fetch all photos for this event
  const { data: allPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", event],
    queryFn: async () => {
      const url = event
        ? `/api/photos?event=${encodeURIComponent(event)}`
        : "/api/photos"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch photos")
      return res.json() as Promise<ManifestPhoto[]>
    },
  })

  // Fetch person photo names if filtering by person
  const { data: personPhotoNames } = useQuery({
    queryKey: ["person-photos", personId],
    queryFn: async () => {
      const res = await fetch(
        `/api/photos?person_id=${encodeURIComponent(personId!)}`
      )
      if (!res.ok) throw new Error("Failed to fetch person photos")
      return res.json() as Promise<string[]>
    },
    enabled: !!personId,
  })

  // Filter by person
  const filtered = useMemo(() => {
    if (!allPhotos) return []
    if (!personId) return allPhotos
    if (!personPhotoNames) return []
    const nameSet = new Set(personPhotoNames)
    return allPhotos.filter((p) => nameSet.has(p.name))
  }, [allPhotos, personId, personPhotoNames])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [event, personId])

  const photos = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  )

  const hasNextPage = photos.length < filtered.length
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)

  const fetchNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    setIsFetchingNextPage(true)
    // Simulate async to give UI a chance to render
    requestAnimationFrame(() => {
      setPage((p) => p + 1)
      setIsFetchingNextPage(false)
    })
  }, [hasNextPage, isFetchingNextPage])

  return {
    photos,
    loading: photosLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }
}
