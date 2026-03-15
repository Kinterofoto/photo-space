"use client"

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query"
import type { ManifestPhoto } from "@/types/photo"

const DEFAULT_PAGE_SIZE = 30

export function useInfinitePhotos(
  event?: string | null,
  personId?: string | null,
  pageSize = DEFAULT_PAGE_SIZE
) {
  const query = useInfiniteQuery({
    queryKey: ["infinite-photos", event ?? null, personId ?? null, pageSize],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams()
      if (event) params.set("event", event)
      if (personId) params.set("person_id", personId)
      params.set("limit", String(pageSize))
      params.set("offset", String(pageParam))
      const res = await fetch(`/api/photos?${params}`)
      if (!res.ok) throw new Error("Failed to fetch photos")
      return res.json() as Promise<ManifestPhoto[]>
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) return undefined
      return allPages.length * pageSize
    },
    initialPageParam: 0,
    placeholderData: keepPreviousData,
  })

  return {
    photos: query.data?.pages.flat() ?? [],
    pagesWithIndex: (query.data?.pages ?? []).map((page, i) => ({ photos: page, pageIndex: i })),
    loading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
