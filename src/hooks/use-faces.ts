import { useQuery } from "@tanstack/react-query"

export interface FaceData {
  id: string
  photoName: string
  personId: string | null
  landmarks: { x: number; y: number }[]
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  personName: string | null
}

async function fetchFaces(photoName: string): Promise<FaceData[]> {
  const res = await fetch(
    `/api/faces?photo_name=${encodeURIComponent(photoName)}`
  )
  if (!res.ok) throw new Error("Failed to fetch faces")
  return res.json()
}

export function useFaces(photoName: string | null) {
  return useQuery({
    queryKey: ["faces", photoName],
    queryFn: () => fetchFaces(photoName!),
    enabled: !!photoName,
  })
}
