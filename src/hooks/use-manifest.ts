"use client"

import { useQuery } from "@tanstack/react-query"
import type { ManifestPhoto } from "@/types/photo"

export function useManifest() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => {
      const res = await fetch("/api/photos")
      if (!res.ok) throw new Error("Failed to load photos")
      return res.json() as Promise<ManifestPhoto[]>
    },
    retry: 3,
  })

  return { photos: data ?? [], loading: isLoading, error: error ?? null }
}
