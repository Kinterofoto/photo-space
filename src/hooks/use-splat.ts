"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { SplatInfo, SplatStatus } from "@/types/photo"

type SplatResponse = SplatInfo | { status: "none" }

async function fetchSplatStatus(photoName: string): Promise<SplatResponse> {
  const res = await fetch(
    `/api/splats?photo_name=${encodeURIComponent(photoName)}`
  )
  if (!res.ok) throw new Error("Failed to fetch splat status")
  return res.json()
}

export function useSplatStatus(photoName: string | null) {
  return useQuery({
    queryKey: ["splat", photoName],
    queryFn: () => fetchSplatStatus(photoName!),
    enabled: !!photoName,
    refetchInterval: (query) => {
      const status = (query.state.data as SplatResponse | undefined)?.status
      return status === "processing" || status === "pending" ? 2000 : false
    },
  })
}

export function useGenerateSplat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photoName: string) => {
      const res = await fetch("/api/splats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoName }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Generation failed")
      }
      return res.json() as Promise<SplatInfo>
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["splat", data.photoName], data)
    },
  })
}
