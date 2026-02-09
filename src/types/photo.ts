export interface ManifestPhoto {
  id: string
  name: string
  url: string
  thumbUrl: string
  width: number | null
  height: number | null
}

export interface ProcessedPhoto extends ManifestPhoto {
  position: [number, number, number]
  rotation: [number, number, number]
  size: number
  floatSpeed: number
  floatOffset: number
}
