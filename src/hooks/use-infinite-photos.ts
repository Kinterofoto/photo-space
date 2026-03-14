"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type { ManifestPhoto } from "@/types/photo"

const PAGE_SIZE = 30

export function useInfinitePhotos(
  event?: string | null,
  personId?: string | null
) {
  const query = useInfiniteQuery({
    queryKey: ["infinite-photos", event ?? null, personId ?? null],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams()
      if (event) params.set("event", event)
      if (personId) params.set("person_id", personId)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(pageParam))
      const res = await fetch(`/api/photos?${params}`)
      if (!res.ok) throw new Error("Failed to fetch photos")
      return res.json() as Promise<ManifestPhoto[]>
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return allPages.length * PAGE_SIZE
    },
    initialPageParam: 0,
  })

  return {
    photos: query.data?.pages.flat() ?? [],
    loading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
