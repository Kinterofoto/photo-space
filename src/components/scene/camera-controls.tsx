"use client"

import { OrbitControls } from "@react-three/drei"

export function CameraControls() {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      panSpeed={0.8}
      minDistance={5}
      maxDistance={2000}
    />
  )
}
