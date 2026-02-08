"use client"

import { useMemo } from "react"
import * as THREE from "three"
import { SPREAD, PARTICLE_COUNT } from "@/lib/constants"

export function Particles() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
      positions[i] = (Math.random() - 0.5) * SPREAD * 3
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="white"
        size={0.5}
        transparent
        opacity={0.15}
        sizeAttenuation
      />
    </points>
  )
}
