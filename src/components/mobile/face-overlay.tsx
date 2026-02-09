"use client"

import { useEffect, useState } from "react"
import type { FaceData } from "@/hooks/use-faces"
import { FACE_MESH_TESSELATION } from "@/lib/face-mesh-tesselation"

interface FaceOverlayProps {
  faces: FaceData[]
  visible: boolean
}

function FaceRegion({
  face,
  delay,
}: {
  face: FaceData
  delay: number
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const cx = (face.boxX + face.boxW / 2) * 100
  const cy = (face.boxY + face.boxH / 2) * 100

  const isMesh = face.landmarks.length >= 468

  return (
    <g
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "scale(1)" : "scale(0.85)",
        transformOrigin: `${cx}% ${cy}%`,
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
      }}
    >
      {/* Bounding box */}
      <rect
        x={`${face.boxX * 100}%`}
        y={`${face.boxY * 100}%`}
        width={`${face.boxW * 100}%`}
        height={`${face.boxH * 100}%`}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.15"
        strokeDasharray="0.8 0.4"
      />

      {isMesh ? (
        /* 468-point mesh wireframe */
        <g>
          {FACE_MESH_TESSELATION.map(([a, b], i) => {
            const ptA = face.landmarks[a]
            const ptB = face.landmarks[b]
            if (!ptA || !ptB) return null
            return (
              <line
                key={i}
                x1={`${ptA.x * 100}%`}
                y1={`${ptA.y * 100}%`}
                x2={`${ptB.x * 100}%`}
                y2={`${ptB.y * 100}%`}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.08"
              />
            )
          })}
        </g>
      ) : (
        /* Fallback: render individual dots for non-468 landmarks */
        <g>
          {face.landmarks.map((pt, i) => (
            <circle
              key={i}
              cx={`${pt.x * 100}%`}
              cy={`${pt.y * 100}%`}
              r="0.15"
              fill="rgba(255,255,255,0.15)"
            />
          ))}
        </g>
      )}

      {/* Person name label */}
      {face.personName && (
        <text
          x={`${face.boxX * 100}%`}
          y={`${(face.boxY + face.boxH) * 100 + 1.5}%`}
          fill="rgba(255,255,255,0.25)"
          fontSize="1.2"
          fontFamily="monospace"
        >
          {face.personName}
        </text>
      )}
    </g>
  )
}

export function FaceOverlay({ faces, visible }: FaceOverlayProps) {
  if (!visible || faces.length === 0) return null

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 10 }}
    >
      {faces.map((face, i) => (
        <FaceRegion key={face.id} face={face} delay={i * 120} />
      ))}
    </svg>
  )
}
