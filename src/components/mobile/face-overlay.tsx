"use client"

import { useEffect, useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePersons } from "@/hooks/use-persons"
import type { FaceData } from "@/hooks/use-faces"

const IS_DEV = process.env.NODE_ENV === "development"

interface FaceOverlayProps {
  faces: FaceData[]
  visible: boolean
}

function FaceRegion({
  face,
  delay,
  onSelect,
  isSelected,
}: {
  face: FaceData
  delay: number
  onSelect?: (face: FaceData) => void
  isSelected?: boolean
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const cx = (face.boxX + face.boxW / 2) * 100
  const cy = (face.boxY + face.boxH / 2) * 100

  return (
    <g
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "scale(1)" : "scale(0.85)",
        transformOrigin: `${cx}% ${cy}%`,
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        cursor: IS_DEV ? "pointer" : undefined,
        pointerEvents: IS_DEV ? "all" : "none",
      }}
      onClick={
        IS_DEV && onSelect
          ? (e) => {
              e.stopPropagation()
              onSelect(face)
            }
          : undefined
      }
    >
      {/* Bounding box */}
      <rect
        x={`${face.boxX * 100}%`}
        y={`${face.boxY * 100}%`}
        width={`${face.boxW * 100}%`}
        height={`${face.boxH * 100}%`}
        fill={isSelected ? "rgba(233,161,201,0.3)" : "rgba(233,161,201,0.15)"}
        stroke={isSelected ? "rgba(233,161,201,0.8)" : "rgba(233,161,201,0.4)"}
        strokeWidth="0.15"
        strokeDasharray={isSelected ? "none" : "0.8 0.4"}
      />

      {/* Landmark dots */}
      {face.landmarks.length > 0 && (
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

function DebugPanel({
  face,
  onClose,
}: {
  face: FaceData
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data: allPersons } = usePersons()
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["faces"] })
    queryClient.invalidateQueries({ queryKey: ["persons"] })
  }, [queryClient])

  const handleUntag = useCallback(async () => {
    setBusy(true)
    await fetch("/api/faces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faceId: face.id, personId: null }),
    })
    invalidate()
    onClose()
  }, [face.id, invalidate, onClose])

  const handleReassign = useCallback(
    async (personId: string) => {
      setBusy(true)
      await fetch("/api/faces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceId: face.id, personId }),
      })
      invalidate()
      onClose()
    },
    [face.id, invalidate, onClose]
  )

  const handleCreatePerson = useCallback(async () => {
    if (!search.trim()) return
    setBusy(true)
    await fetch("/api/faces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faceId: face.id, newPersonName: search.trim() }),
    })
    invalidate()
    onClose()
  }, [face.id, search, invalidate, onClose])

  const filtered = (allPersons ?? []).filter((p) => {
    if (!search) return true
    const label = p.name || p.id
    return label.toLowerCase().includes(search.toLowerCase())
  })

  const exactMatch = search.trim() && (allPersons ?? []).some(
    (p) => p.name?.toLowerCase() === search.trim().toLowerCase()
  )

  // Position panel near the face
  const left = `${Math.min(face.boxX * 100 + face.boxW * 100, 70)}%`
  const top = `${Math.min(face.boxY * 100, 60)}%`

  return (
    <div
      className="absolute z-50 w-48 rounded-lg border border-white/10 bg-black/90 p-2 text-xs text-white/80 shadow-xl backdrop-blur-md"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/40">
          {face.personName || "untagged"}
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60"
        >
          ✕
        </button>
      </div>

      {/* Untag button */}
      {face.personId && (
        <button
          onClick={handleUntag}
          disabled={busy}
          className="mb-2 w-full rounded bg-red-500/20 px-2 py-1.5 text-left font-mono text-[10px] text-red-400 hover:bg-red-500/30 disabled:opacity-50"
        >
          remove tag
        </button>
      )}

      {/* Reassign */}
      <input
        type="text"
        placeholder="search person..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/70 placeholder:text-white/20 focus:border-white/20 focus:outline-none"
        autoFocus
      />
      <div className="max-h-32 overflow-y-auto">
        {/* Create new person option */}
        {search.trim() && !exactMatch && (
          <button
            onClick={handleCreatePerson}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded bg-green-500/10 px-2 py-1 text-left font-mono text-[10px] text-green-400 hover:bg-green-500/20 disabled:opacity-50"
          >
            + create "{search.trim()}"
          </button>
        )}
        {filtered.slice(0, 20).map((p) => (
          <button
            key={p.id}
            onClick={() => handleReassign(p.id)}
            disabled={busy || p.id === face.personId}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-[10px] hover:bg-white/10 disabled:opacity-30"
          >
            {p.representativeFace?.thumbnail && (
              <img
                src={p.representativeFace.thumbnail}
                className="h-5 w-5 rounded-full object-cover"
                alt=""
              />
            )}
            <span className="truncate">
              {p.name || `unnamed (${p.faceCount})`}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FaceOverlay({ faces, visible }: FaceOverlayProps) {
  const [selectedFace, setSelectedFace] = useState<FaceData | null>(null)

  if (!visible || faces.length === 0) return null

  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{ zIndex: 10, pointerEvents: IS_DEV ? "auto" : "none" }}
      onClick={IS_DEV ? () => setSelectedFace(null) : undefined}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ pointerEvents: IS_DEV ? "all" : "none" }}
      >
        {faces.map((face, i) => (
          <FaceRegion
            key={face.id}
            face={face}
            delay={i * 120}
            onSelect={IS_DEV ? setSelectedFace : undefined}
            isSelected={selectedFace?.id === face.id}
          />
        ))}
      </svg>

      {/* Debug panel */}
      {IS_DEV && selectedFace && (
        <DebugPanel
          face={selectedFace}
          onClose={() => setSelectedFace(null)}
        />
      )}
    </div>
  )
}
