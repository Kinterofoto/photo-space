/**
 * Transforms a Cloudinary URL to include optimization parameters.
 * Input:  https://res.cloudinary.com/CLOUD/image/upload/v123/photo-space/file.jpg
 * Output: https://res.cloudinary.com/CLOUD/image/upload/w_1920,q_auto,f_auto/v123/photo-space/file.jpg
 */
export function getOptimizedUrl(url: string): string {
  const marker = "/image/upload/"
  const idx = url.indexOf(marker)
  if (idx === -1) return url

  const insertAt = idx + marker.length
  return `${url.slice(0, insertAt)}w_1920,q_auto,f_auto/${url.slice(insertAt)}`
}
