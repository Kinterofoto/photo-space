import { seededRandom } from "./seeded-random"
import { SHELL_0_RADIUS, SHELL_STEP } from "./constants"
import type { ManifestPhoto, ProcessedPhoto } from "@/types/photo"

export interface ShellBounds {
  inner: number
  outer: number
}

/** Shell 0: 0–SHELL_0_RADIUS, Shell N>0: expanding rings beyond that */
export function getShellBounds(pageIndex: number): ShellBounds {
  if (pageIndex === 0) return { inner: 0, outer: SHELL_0_RADIUS }
  return {
    inner: SHELL_0_RADIUS + (pageIndex - 1) * SHELL_STEP,
    outer: SHELL_0_RADIUS + pageIndex * SHELL_STEP,
  }
}

interface PlaceOpts {
  spreadScale?: number
}

/** Place a single photo in a spherical shell determined by pageIndex */
export function placePhoto(
  photo: ManifestPhoto,
  pageIndex: number,
  opts?: PlaceOpts
): ProcessedPhoto {
  const rand = seededRandom(photo.id)
  const scale = opts?.spreadScale ?? 1.0
  const { inner, outer } = getShellBounds(pageIndex)

  // Random radius within the shell
  const r = (inner + rand() * (outer - inner)) * scale

  // Spherical coordinates — uniform distribution on sphere
  const theta = rand() * Math.PI * 2 // azimuth
  const phi = Math.acos(2 * rand() - 1) // polar (uniform on sphere)

  const x = r * Math.sin(phi) * Math.cos(theta)
  const y = r * Math.sin(phi) * Math.sin(theta)
  const z = r * Math.cos(phi)

  return {
    ...photo,
    position: [x, y, z],
    rotation: [
      (rand() - 0.5) * 0.3,
      (rand() - 0.5) * 0.3,
      (rand() - 0.5) * 0.15,
    ],
    size: 25 + rand() * 10,
    floatSpeed: 0.2 + rand() * 0.5,
    floatOffset: rand() * Math.PI * 2,
  }
}

/** Process an entire page of photos into placed ProcessedPhotos */
export function processPage(
  photos: ManifestPhoto[],
  pageIndex: number,
  opts?: PlaceOpts
): ProcessedPhoto[] {
  return photos.map((photo) => placePhoto(photo, pageIndex, opts))
}
