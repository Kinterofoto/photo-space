"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { LOD_DISTANCE } from "@/lib/constants"
import type { ProcessedPhoto } from "@/types/photo"

interface PhotoCardProps {
  photo: ProcessedPhoto
  onDownload: (filename: string) => void
  isDragging: React.RefObject<boolean>
  dimmed?: boolean
}

export function PhotoCard({ photo, onDownload, isDragging, dimmed = false }: PhotoCardProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null
  )
  const [hiRes, setHiRes] = useState(false)
  const [loadingHiRes, setLoadingHiRes] = useState(false)
  const glowRef = useRef(0)
  const currentOpacity = useRef(1)

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
    }
    img.onerror = () => setLoadingHiRes(false)
    img.src = photo.url
  }, [hiRes, loadingHiRes, photo.url])

  // Animation loop
  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = state.clock.getElapsedTime()

    // Floating animation
    mesh.position.y +=
      Math.sin(t * photo.floatSpeed + photo.floatOffset) * 0.005
    mesh.rotation.y += 0.0003

    // LOD check
    const dist = state.camera.position.distanceTo(mesh.position)
    if (dist < LOD_DISTANCE) upgradeToHiRes()

    // Smooth dimming when filtered
    const targetOpacity = dimmed ? 0.08 : 1
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.05
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = currentOpacity.current

    // Glow effect (after download click)
    if (glowRef.current > 0) {
      glowRef.current = Math.max(0, glowRef.current - 0.018)
      const g = glowRef.current
      const boost = 1 + g * 1.5
      mat.color.setRGB(boost, boost, boost)
      mesh.scale.setScalar(1 + g * 0.06)
    }
  })

  // Click handler with drag guard
  const handleClick = useCallback(() => {
    if (isDragging.current) return
    glowRef.current = 1.0
    onDownload(photo.name)
  }, [photo.name, onDownload, isDragging])

  if (!texture || !dims) return null

  return (
    <mesh
      ref={meshRef}
      position={photo.position}
      rotation={photo.rotation}
      onClick={handleClick}
    >
      <planeGeometry args={[dims.width, dims.height]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
    </mesh>
  )
}
