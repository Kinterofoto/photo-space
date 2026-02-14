"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { LOD_DISTANCE } from "@/lib/constants"
import { getOptimizedUrl } from "@/lib/cloudinary"
import type { ProcessedPhoto } from "@/types/photo"

// Global concurrency semaphore: max 3 hi-res loads at once
let activeLoads = 0
const MAX_CONCURRENT_LOADS = 3
const loadQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    loadQueue.push(() => {
      activeLoads++
      resolve()
    })
  })
}

function releaseSlot() {
  activeLoads--
  const next = loadQueue.shift()
  if (next) next()
}

const DISSOLVE_GRID = 55
const DISSOLVE_DURATION = 2.5 // seconds

interface PhotoCardProps {
  photo: ProcessedPhoto
  onDownload: (filename: string) => void
  isDragging: React.RefObject<boolean>
  dimmed?: boolean
}

export function PhotoCard({ photo, onDownload, isDragging, dimmed = false }: PhotoCardProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null
  )
  const [hiRes, setHiRes] = useState(false)
  const [loadingHiRes, setLoadingHiRes] = useState(false)
  const [dissolving, setDissolving] = useState(false)
  const [hidden, setHidden] = useState(false)
  const dissolveStartTime = useRef(0)
  const currentOpacity = useRef(1)
  const frameCount = useRef(0)

  // Dissolve particle data (stored in refs to avoid re-renders)
  const dissolveGeo = useRef<THREE.BufferGeometry | null>(null)
  const dissolveMat = useRef<THREE.PointsMaterial | null>(null)
  const velocities = useRef<Float32Array | null>(null)
  const lifetimes = useRef<Float32Array | null>(null)
  const phases = useRef<Float32Array | null>(null)
  const freqs = useRef<Float32Array | null>(null)
  const originalPositions = useRef<Float32Array | null>(null)

  // Load initial thumbnail texture
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const tex = new THREE.Texture(img)
      tex.needsUpdate = true
      tex.colorSpace = THREE.SRGBColorSpace

      const aspect = img.width / img.height
      const width = aspect >= 1 ? photo.size : photo.size * aspect
      const height = aspect >= 1 ? photo.size / aspect : photo.size

      setTexture(tex)
      setDims({ width, height })
    }
    img.src = photo.thumbUrl
  }, [photo.thumbUrl, photo.size])

  // LOD: upgrade to hi-res when camera is close
  const upgradeToHiRes = useCallback(() => {
    if (hiRes || loadingHiRes) return
    setLoadingHiRes(true)

    const optimizedUrl = getOptimizedUrl(photo.url)

    acquireSlot().then(() => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const tex = new THREE.Texture(img)
        tex.needsUpdate = true
        tex.colorSpace = THREE.SRGBColorSpace
        setTexture((prev) => {
          prev?.dispose()
          return tex
        })
        setHiRes(true)
        releaseSlot()
      }
      img.onerror = () => {
        setLoadingHiRes(false)
        releaseSlot()
      }
      img.src = optimizedUrl
    })
  }, [hiRes, loadingHiRes, photo.url])

  // Start dissolve effect
  const startDissolve = useCallback(() => {
    if (dissolving || !texture || !dims) return

    // Sample the texture onto an offscreen canvas
    const img = texture.image as HTMLImageElement
    const offscreen = document.createElement("canvas")
    const gridW = DISSOLVE_GRID
    const gridH = Math.round(DISSOLVE_GRID * (dims.height / dims.width))
    offscreen.width = gridW
    offscreen.height = gridH
    const ctx = offscreen.getContext("2d")
    if (!ctx) return

    ctx.drawImage(img, 0, 0, gridW, gridH)
    const imageData = ctx.getImageData(0, 0, gridW, gridH)
    const pixels = imageData.data

    const count = gridW * gridH
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const vels = new Float32Array(count * 3)
    const lives = new Float32Array(count)
    const phs = new Float32Array(count)
    const fqs = new Float32Array(count)
    const origPos = new Float32Array(count * 3)

    let idx = 0
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const pi = (y * gridW + x) * 4

        // Map pixel position to mesh local coordinates
        const px = (x / gridW - 0.5) * dims.width
        const py = (0.5 - y / gridH) * dims.height
        const pz = 0

        positions[idx * 3] = px
        positions[idx * 3 + 1] = py
        positions[idx * 3 + 2] = pz

        origPos[idx * 3] = px
        origPos[idx * 3 + 1] = py
        origPos[idx * 3 + 2] = pz

        colors[idx * 3] = pixels[pi] / 255
        colors[idx * 3 + 1] = pixels[pi + 1] / 255
        colors[idx * 3 + 2] = pixels[pi + 2] / 255

        // Random velocity with upward bias
        const angle = Math.random() * Math.PI * 2
        const speed = 0.5 + Math.random() * 1.5
        vels[idx * 3] = Math.cos(angle) * speed
        vels[idx * 3 + 1] = Math.abs(Math.sin(angle)) * speed + 0.5
        vels[idx * 3 + 2] = (Math.random() - 0.5) * speed

        lives[idx] = 1.5 + Math.random() * 1.5
        phs[idx] = Math.random() * Math.PI * 2
        fqs[idx] = 2 + Math.random() * 3

        idx++
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    })

    dissolveGeo.current = geo
    dissolveMat.current = mat
    velocities.current = vels
    lifetimes.current = lives
    phases.current = phs
    freqs.current = fqs
    originalPositions.current = origPos

    setDissolving(true)
    dissolveStartTime.current = 0 // will be set on first frame
  }, [dissolving, texture, dims])

  // Animation loop
  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = state.clock.getElapsedTime()

    // Floating animation
    mesh.position.y +=
      Math.sin(t * photo.floatSpeed + photo.floatOffset) * 0.005
    mesh.rotation.y += 0.0003

    // LOD check — throttled to every 10 frames
    frameCount.current++
    if (frameCount.current % 10 === 0) {
      const dist = state.camera.position.distanceTo(mesh.position)
      if (dist < LOD_DISTANCE) upgradeToHiRes()
    }

    // Smooth dimming when filtered
    const targetOpacity = dimmed ? 0.08 : 1
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.05

    // Dissolve animation
    if (dissolving) {
      if (dissolveStartTime.current === 0) {
        dissolveStartTime.current = t
      }
      const elapsed = t - dissolveStartTime.current
      const progress = Math.min(elapsed / DISSOLVE_DURATION, 1)

      // Fade out mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - progress * 3) * currentOpacity.current

      // Animate particles
      const geo = dissolveGeo.current
      const vels = velocities.current
      const lives = lifetimes.current
      const phs = phases.current
      const fqs = freqs.current
      const origPos = originalPositions.current
      if (geo && vels && lives && phs && fqs && origPos) {
        const posAttr = geo.getAttribute("position") as THREE.BufferAttribute
        const positions = posAttr.array as Float32Array
        const count = posAttr.count

        for (let i = 0; i < count; i++) {
          const lifeProgress = Math.min(elapsed / lives[i], 1)

          // Move from original position
          const turbX = Math.sin(elapsed * fqs[i] + phs[i]) * 0.3
          const turbY = Math.cos(elapsed * fqs[i] * 0.7 + phs[i] * 1.3) * 0.15

          positions[i * 3] = origPos[i * 3] + (vels[i * 3] + turbX) * elapsed
          positions[i * 3 + 1] = origPos[i * 3 + 1] + (vels[i * 3 + 1] + turbY) * elapsed
          positions[i * 3 + 2] = origPos[i * 3 + 2] + vels[i * 3 + 2] * elapsed
        }
        posAttr.needsUpdate = true

        // Fade out particles
        if (dissolveMat.current) {
          dissolveMat.current.opacity = 1 - progress * progress
          dissolveMat.current.size = 0.3 * (1 - progress * 0.5)
        }
      }

      // Sync points position/rotation with mesh
      const points = pointsRef.current
      if (points) {
        points.position.copy(mesh.position)
        points.rotation.copy(mesh.rotation)
      }

      // End dissolve — hide permanently
      if (progress >= 1) {
        setDissolving(false)
        dissolveGeo.current?.dispose()
        dissolveMat.current?.dispose()
        dissolveGeo.current = null
        dissolveMat.current = null
        texture?.dispose()
        setHidden(true)
      }
    } else {
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = currentOpacity.current
    }
  })

  // Click handler with drag guard
  const handleClick = useCallback(() => {
    if (isDragging.current) return
    startDissolve()
    onDownload(photo.name)
  }, [photo.name, onDownload, isDragging, startDissolve])

  if (hidden || !texture || !dims) return null

  return (
    <>
      <mesh
        ref={meshRef}
        position={photo.position}
        rotation={photo.rotation}
        onClick={handleClick}
      >
        <planeGeometry args={[dims.width, dims.height]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      </mesh>
      {dissolving && dissolveGeo.current && dissolveMat.current && (
        <points ref={pointsRef} geometry={dissolveGeo.current} material={dissolveMat.current} />
      )}
    </>
  )
}
