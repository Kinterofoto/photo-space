export interface ManifestPhoto {
  id: string
  name: string
  url: string
  thumbUrl: string
  width: number | null
  height: number | null
  event: string
}

export interface ProcessedPhoto extends ManifestPhoto {
  position: [number, number, number]
  rotation: [number, number, number]
  size: number
  floatSpeed: number
  floatOffset: number
}

export type SplatStatus = "pending" | "processing" | "ready" | "error"

export interface SplatInfo {
  id: string
  photoName: string
  plyUrl: string | null
  status: SplatStatus
  errorMessage: string | null
}
