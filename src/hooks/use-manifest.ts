"use client"

import { useState, useEffect } from "react"
import type { ManifestPhoto } from "@/types/photo"

export function useManifest(event?: string | null) {
  const [photos, setPhotos] = useState<ManifestPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const url = event ? `/api/photos?event=${encodeURIComponent(event)}` : "/api/photos"
        const res = await fetch(url)
        const data: ManifestPhoto[] = await res.json()
        setPhotos(data)
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load photos")
        )
        console.error("Failed to load photos:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [event])

  return { photos, loading, error }
}
