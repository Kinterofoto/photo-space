export interface ManifestPhoto {
  name: string
  thumb: string
}

export interface ProcessedPhoto extends ManifestPhoto {
  position: [number, number, number]
  rotation: [number, number, number]
  size: number
  floatSpeed: number
  floatOffset: number
}
