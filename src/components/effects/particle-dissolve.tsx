"use client"

import { useRef, useState, useCallback } from "react"

interface Particle {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  r: number
  g: number
  b: number
  alpha: number
  size: number
  life: number
  maxLife: number
  freq: number
  phase: number
}

const PARTICLE_GRID = 55 // ~55x55 = ~3000 particles
const DURATION = 2500

export function useParticleDissolve() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDissolving, setIsDissolving] = useState(false)
  const animRef = useRef<number>(0)
  const imgElRef = useRef<HTMLImageElement | null>(null)

  const trigger = useCallback((imgEl: HTMLImageElement) => {
    if (isDissolving) return
    imgElRef.current = imgEl

    const rect = imgEl.getBoundingClientRect()
    const canvas = canvasRef.current
    if (!canvas) return

    // Size the overlay canvas to match the image position
    canvas.style.position = "absolute"
    canvas.style.left = `${imgEl.offsetLeft}px`
    canvas.style.top = `${imgEl.offsetTop}px`
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    canvas.style.pointerEvents = "none"
    canvas.style.zIndex = "10"
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Sample pixels from image via offscreen canvas
    const offscreen = document.createElement("canvas")
    const sampleW = PARTICLE_GRID
    const sampleH = Math.round(PARTICLE_GRID * (rect.height / rect.width))
    offscreen.width = sampleW
    offscreen.height = sampleH
    const offCtx = offscreen.getContext("2d")
    if (!offCtx) return

    offCtx.drawImage(imgEl, 0, 0, sampleW, sampleH)
    const imageData = offCtx.getImageData(0, 0, sampleW, sampleH)
    const pixels = imageData.data

    // Create particles
    const particles: Particle[] = []
    const scaleX = canvas.width / sampleW
    const scaleY = canvas.height / sampleH

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        const i = (y * sampleW + x) * 4
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const a = pixels[i + 3]
        if (a < 10) continue

        const px = (x + 0.5) * scaleX
        const py = (y + 0.5) * scaleY
        const angle = Math.random() * Math.PI * 2
        const speed = 0.5 + Math.random() * 1.5

        particles.push({
          x: px,
          y: py,
          originX: px,
          originY: py,
          vx: Math.cos(angle) * speed,
          vy: -Math.abs(Math.sin(angle)) * speed - 0.5,
          r,
          g,
          b,
          alpha: 1,
          size: (1 + Math.random() * 2) * window.devicePixelRatio,
          life: 0,
          maxLife: 1500 + Math.random() * 1500,
          freq: 2 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    setIsDissolving(true)

    // Fade out original image
    imgEl.style.transition = "opacity 0.4s ease-out"
    imgEl.style.opacity = "0"

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / DURATION, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.life = elapsed
        const lifeProgress = Math.min(p.life / p.maxLife, 1)

        // Ease-out alpha
        p.alpha = 1 - lifeProgress * lifeProgress

        // Turbulence
        const turbX = Math.sin(elapsed * 0.003 * p.freq + p.phase) * 0.8
        const turbY = Math.cos(elapsed * 0.002 * p.freq + p.phase * 1.3) * 0.4

        p.x += (p.vx + turbX) * 0.8
        p.y += (p.vy + turbY) * 0.8

        // Shrink
        const currentSize = p.size * (1 - lifeProgress * 0.5)

        if (p.alpha > 0.01) {
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        // Restore
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (imgElRef.current) {
          imgElRef.current.style.transition = "opacity 0.3s ease-in"
          imgElRef.current.style.opacity = "1"
        }
        setIsDissolving(false)
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [isDissolving])

  return { trigger, canvasRef, isDissolving }
}
