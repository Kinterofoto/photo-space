import { useQuery } from "@tanstack/react-query"

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

async function fetchPersons(): Promise<PersonWithFace[]> {
  const res = await fetch("/api/persons")
  if (!res.ok) throw new Error("Failed to fetch persons")
  return res.json()
}

export function usePersons() {
  return useQuery({
    queryKey: ["persons"],
    queryFn: fetchPersons,
  })
}
