"use client"

import { useRef, useMemo } from "react"
import { useInfinitePhotos } from "./use-infinite-photos"
import { processPage } from "@/lib/shell-placement"
import type { ProcessedPhoto } from "@/types/photo"

interface UseInfinite3DPhotosOpts {
  spreadScale?: number
  pageSize?: number
}

export function useInfinite3DPhotos(
  event?: string | null,
  personId?: string | null,
  opts?: UseInfinite3DPhotosOpts
) {
  const { pagesWithIndex, loading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfinitePhotos(event, personId, opts?.pageSize)

  // Cache processed photos per page to avoid reprocessing on re-render
  const cacheRef = useRef<Map<string, ProcessedPhoto[]>>(new Map())

  const photos = useMemo(() => {
    const result: ProcessedPhoto[] = []
    const newCache = new Map<string, ProcessedPhoto[]>()

    for (const { photos: pagePhotos, pageIndex } of pagesWithIndex) {
      // Key by page index + first photo id to detect page content changes
      const cacheKey = `${pageIndex}:${pagePhotos[0]?.id ?? "empty"}`
      let processed = cacheRef.current.get(cacheKey)
      if (!processed) {
        processed = processPage(pagePhotos, pageIndex, {
          spreadScale: opts?.spreadScale,
        })
      }
      newCache.set(cacheKey, processed)
      result.push(...processed)
    }

    cacheRef.current = newCache
    return result
  }, [pagesWithIndex, opts?.spreadScale])

  return { photos, loading, hasNextPage, isFetchingNextPage, fetchNextPage }
}
