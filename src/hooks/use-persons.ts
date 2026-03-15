import { useQuery, keepPreviousData } from "@tanstack/react-query"

export interface PersonWithFace {
  id: string
  name: string | null
  faceCount: number
  createdAt: string
  representativeFace: {
    photoName: string
    thumbnail: string | null
  } | null
}

async function fetchPersons(event?: string | null): Promise<PersonWithFace[]> {
  const url = event ? `/api/persons?event=${encodeURIComponent(event)}` : "/api/persons"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch persons")
  return res.json()
}

export function usePersons(event?: string | null) {
  return useQuery({
    queryKey: ["persons", event ?? null],
    queryFn: () => fetchPersons(event),
    placeholderData: keepPreviousData,
  })
}
