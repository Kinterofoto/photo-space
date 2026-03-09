"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { ManifestPhoto } from "@/types/photo"
import { toast } from "sonner"

const DEFAULT_WIDTH = 1600
const DEFAULT_HEIGHT = 1200
const SVG_NS = "http://www.w3.org/2000/svg"

// Cloudinary transform: limit to maxDim, auto quality
function viewUrl(url: string, maxDim = 2048): string {
  return url.replace("/image/upload/", `/image/upload/w_${maxDim},c_limit,q_auto/`)
}

function buildSlides(photos: ManifestPhoto[]) {
  return photos.map((p) => ({
    // Display: capped at 2048px for fast loading
    src: viewUrl(p.url),
    width: p.width ? Math.min(p.width, 2048) : DEFAULT_WIDTH,
    height: p.width && p.height
      ? Math.round(p.height * (Math.min(p.width, 2048) / p.width))
      : DEFAULT_HEIGHT,
    alt: p.name,
    // Custom data for download (original full-res)
    photoName: p.name,
    downloadUrl: p.url,
  }))
}

// ── Face overlay helpers ──────────────────────────────────────────────

interface FaceBox {
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  personName: string | null
}

function renderFaceBoxes(container: HTMLElement, faces: FaceBox[]) {
  container.innerHTML = ""
  if (faces.length === 0) return

  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("viewBox", "0 0 100 100")
  svg.setAttribute("preserveAspectRatio", "none")
  svg.style.cssText = "width:100%;height:100%;opacity:0;transition:opacity 0.5s ease-out;"

  for (const face of faces) {
    const g = document.createElementNS(SVG_NS, "g")

    const rect = document.createElementNS(SVG_NS, "rect")
    rect.setAttribute("x", `${face.boxX * 100}%`)
    rect.setAttribute("y", `${face.boxY * 100}%`)
    rect.setAttribute("width", `${face.boxW * 100}%`)
    rect.setAttribute("height", `${face.boxH * 100}%`)
    rect.setAttribute("fill", "rgba(233,161,201,0.15)")
    rect.setAttribute("stroke", "rgba(233,161,201,0.4)")
    rect.setAttribute("stroke-width", "0.15")
    rect.setAttribute("stroke-dasharray", "0.8 0.4")
    g.appendChild(rect)

    if (face.personName) {
      const text = document.createElementNS(SVG_NS, "text")
      text.setAttribute("x", `${face.boxX * 100}%`)
      text.setAttribute("y", `${(face.boxY + face.boxH) * 100 + 1.5}%`)
      text.setAttribute("fill", "rgba(255,255,255,0.25)")
      text.setAttribute("font-size", "1.2")
      text.setAttribute("font-family", "monospace")
      text.textContent = face.personName
      g.appendChild(text)
    }

    svg.appendChild(g)
  }

  container.appendChild(svg)
  requestAnimationFrame(() => { svg.style.opacity = "1" })
}

/** Find or create the face overlay div inside a slide container */
function getOrCreateOverlay(slide: any): HTMLDivElement | null {
  if (!slide?.container) return null
  let overlay = slide.container.querySelector(".pswp-face-overlay") as HTMLDivElement | null
  if (!overlay) {
    overlay = document.createElement("div")
    overlay.className = "pswp-face-overlay"
    overlay.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:1;"
    slide.container.appendChild(overlay)
  }
  return overlay
}

function loadFacesForOverlay(
  overlay: HTMLDivElement,
  photoName: string | undefined,
  showFaces: boolean
) {
  if (!photoName || !showFaces) {
    overlay.innerHTML = ""
    overlay.dataset.photo = ""
    return
  }

  if (overlay.dataset.photo === photoName) return
  overlay.dataset.photo = photoName

  fetch(`/api/faces?photo_name=${encodeURIComponent(photoName)}`)
    .then((r) => r.json())
    .then((faces: FaceBox[]) => {
      if (overlay.dataset.photo === photoName) {
        renderFaceBoxes(overlay, faces)
      }
    })
    .catch(() => {})
}

// ── Hook ──────────────────────────────────────────────────────────────

export function usePhotoSwipe(
  photos: ManifestPhoto[],
  gallerySelector: string,
  showFaces = false
) {
  const lightboxRef = useRef<any>(null)
  const photosRef = useRef(photos)
  photosRef.current = photos
  const showFacesRef = useRef(showFaces)
  showFacesRef.current = showFaces
  const [currentPhotoName, setCurrentPhotoName] = useState<string | null>(null)

  useEffect(() => {
    let lightbox: any

    async function init() {
      const [{ default: PhotoSwipeLightbox }, { default: PhotoSwipe }] =
        await Promise.all([
          import("photoswipe/lightbox"),
          import("photoswipe"),
        ])

      lightbox = new PhotoSwipeLightbox({
        dataSource: buildSlides(photosRef.current),
        pswpModule: PhotoSwipe,
        bgOpacity: 1,
        showHideAnimationType: "zoom",
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        closeOnVerticalDrag: true,
        pinchToClose: true,
        preloaderDelay: 0,
        maxZoomLevel: 3,
        wheelToZoom: true,
      })

      // Thumbnail zoom animation — find the img in the gallery
      lightbox.addFilter(
        "thumbEl",
        (_thumbEl: HTMLElement, _data: any, index: number) => {
          const galleryEl = document.querySelector(gallerySelector)
          if (!galleryEl) return _thumbEl
          const thumbs = galleryEl.querySelectorAll("[data-pswp-thumb]")
          const el = thumbs[index] as HTMLElement | null
          return el || _thumbEl
        }
      )

      // Custom download button — downloads original full-res
      lightbox.on("uiRegister", () => {
        lightbox.pswp.ui.registerElement({
          name: "download-button",
          order: 8,
          isButton: true,
          tagName: "a",
          html: {
            isCustomSVG: true,
            inner:
              '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 15.7l6 6.3 6-6.3ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
            outlineID: "pswp__icn-download",
          },
          onInit: (el: HTMLAnchorElement, pswp: any) => {
            pswp.on("change", () => {
              const slide = pswp.currSlide?.data
              if (slide) {
                el.href = slide.downloadUrl
                el.download = slide.photoName || "photo"
                el.target = "_blank"
              }
            })
          },
          onClick: (e: Event, _el: HTMLAnchorElement, pswp: any) => {
            e.preventDefault()
            const slide = pswp.currSlide?.data
            if (!slide) return

            fetch(slide.downloadUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const blobUrl = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = blobUrl
                a.download = slide.photoName || "photo"
                a.click()
                URL.revokeObjectURL(blobUrl)
                toast("saved", {
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "14px",
                    letterSpacing: "2px",
                    textTransform: "lowercase",
                    boxShadow: "none",
                  },
                })
              })
              .catch(() => {
                window.open(slide.downloadUrl, "_blank")
              })
          },
        })

        // Counter
        lightbox.pswp.ui.registerElement({
          name: "photo-counter",
          order: 5,
          isButton: false,
          appendTo: "bar",
          html: "",
          onInit: (el: HTMLElement, pswp: any) => {
            el.style.cssText =
              "font-family:monospace;font-size:11px;color:rgba(255,255,255,0.3);position:absolute;left:50%;transform:translateX(-50%);top:18px;letter-spacing:1px;"
            const update = () => {
              el.textContent = `${(pswp.currIndex ?? 0) + 1} / ${pswp.getNumItems()}`
            }
            pswp.on("change", update)
            update()
          },
        })
      })

      // Face overlay: contentResize fires on the pswp instance when a
      // slide image gets its display size. Register on lightbox so the
      // handler is attached before pswp dispatches its first events
      // (change + contentResize fire BEFORE afterInit).
      lightbox.on("contentResize", (e: any) => {
        const { content, width, height } = e
        const slide = content?.slide
        const overlay = getOrCreateOverlay(slide)
        if (!overlay) return

        overlay.style.width = width + "px"
        overlay.style.height = height + "px"

        if (slide === lightbox.pswp?.currSlide) {
          loadFacesForOverlay(overlay, slide.data?.photoName, showFacesRef.current)
        }
      })

      lightbox.on("change", () => {
        const pswp = lightbox.pswp
        setCurrentPhotoName(pswp?.currSlide?.data?.photoName ?? null)

        const slide = pswp?.currSlide
        const overlay = slide?.container?.querySelector(".pswp-face-overlay") as HTMLDivElement | null
        if (overlay) {
          loadFacesForOverlay(overlay, slide.data?.photoName, showFacesRef.current)
        }
      })

      lightbox.on("destroy", () => {
        setCurrentPhotoName(null)
      })

      lightbox.init()
      lightboxRef.current = lightbox
    }

    init()

    return () => {
      lightbox?.destroy()
      lightboxRef.current = null
    }
  }, [gallerySelector])

  // Update dataSource when photos change
  useEffect(() => {
    if (lightboxRef.current) {
      lightboxRef.current.options.dataSource = buildSlides(photos)
    }
  }, [photos])

  // React to showFaces toggle while lightbox is open
  useEffect(() => {
    const pswp = lightboxRef.current?.pswp
    if (!pswp?.currSlide) return
    const overlay = pswp.currSlide.container?.querySelector(".pswp-face-overlay") as HTMLDivElement | null
    if (overlay) {
      overlay.dataset.photo = "" // reset cache to force re-evaluation
      loadFacesForOverlay(overlay, pswp.currSlide.data?.photoName, showFaces)
    }
  }, [showFaces])

  const open = useCallback((index: number) => {
    lightboxRef.current?.loadAndOpen(index)
  }, [])

  return { open, currentPhotoName }
}
