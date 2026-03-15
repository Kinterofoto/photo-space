"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Suspense, useMemo, useCallback, useRef } from "react"
import * as THREE from "three"
import { toast } from "sonner"
import { PhotoCard } from "@/components/scene/photo-card"
import { useInfinite3DPhotos } from "@/hooks/use-infinite-3d-photos"
import { getShellBounds } from "@/lib/shell-placement"
import {
  MOBILE_SPREAD_SCALE,
  MOBILE_PARTICLE_COUNT,
  MOBILE_PAGE_SIZE,
} from "@/lib/constants"
import type { ProcessedPhoto } from "@/types/photo"

const MOBILE_LOD_DISTANCE = 30
const MOBILE_HIRES_WIDTH = 1200

function MobileParticles() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(MOBILE_PARTICLE_COUNT * 3)
    // Tighter spread to match mobile shell placement
    const spread = 80 * MOBILE_SPREAD_SCALE * 3
    for (let i = 0; i < MOBILE_PARTICLE_COUNT * 3; i++) {
      positions[i] = (Math.random() - 0.5) * spread
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="white"
        size={0.4}
        transparent
        opacity={0.12}
        sizeAttenuation
      />
    </points>
  )
}

function MobileCameraControls() {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={1.0}
      panSpeed={0.8}
      minDistance={5}
      maxDistance={500}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  )
}

function CameraDistanceTrigger({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  pageCount,
  filterKey,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  pageCount: number
  filterKey: string
}) {
  const triggeredRef = useRef(new Set<number>())
  const prevFilterKey = useRef(filterKey)

  if (prevFilterKey.current !== filterKey) {
    triggeredRef.current = new Set()
    prevFilterKey.current = filterKey
  }

  useFrame((state) => {
    if (!hasNextPage || isFetchingNextPage) return

    const camDist = state.camera.position.length()
    const nextShell = getShellBounds(pageCount)

    if (camDist > nextShell.inner - 20 && !triggeredRef.current.has(pageCount)) {
      triggeredRef.current.add(pageCount)
      fetchNextPage()
    }
  })

  return null
}

interface Mobile3DSceneProps {
  event?: string | null
  personId?: string | null
}

export function Mobile3DScene({ event, personId }: Mobile3DSceneProps) {
  const {
    photos,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfinite3DPhotos(event, personId, {
    spreadScale: MOBILE_SPREAD_SCALE,
    pageSize: MOBILE_PAGE_SIZE,
  })

  const downloadingRef = useRef(false)
  const isDragging = useRef(false)

  const pageCount = useMemo(
    () => Math.ceil(photos.length / MOBILE_PAGE_SIZE) || 1,
    [photos.length]
  )
  const filterKey = `${event ?? "all"}-${personId ?? "none"}`

  const handleDownload = useCallback(
    async (filename: string) => {
      if (downloadingRef.current) return
      downloadingRef.current = true

      const photo = photos.find((p) => p.name === filename)
      if (!photo) {
        downloadingRef.current = false
        return
      }

      try {
        // iOS-friendly download via window.open
        window.open(photo.url, "_blank")
        toast("opening photo", {
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
      } catch {
        toast.error("download failed")
      } finally {
        downloadingRef.current = false
      }
    },
    [photos]
  )

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 80], fov: 60, near: 0.1, far: 2000 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "low-power" }}
        onPointerDown={(e) => {
          isDragging.current = false
        }}
        onPointerMove={(e) => {
          isDragging.current = true
        }}
      >
        <color attach="background" args={["black"]} />
        <fogExp2 attach="fog" args={["black", 0.005]} />
        <ambientLight intensity={1.5} />

        <Suspense fallback={null}>
          {photos.map((photo) => (
            <PhotoCard
              key={photo.name}
              photo={photo}
              onDownload={handleDownload}
              isDragging={isDragging}
              hiResWidth={MOBILE_HIRES_WIDTH}
              lodDistance={MOBILE_LOD_DISTANCE}
            />
          ))}
        </Suspense>

        <CameraDistanceTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          pageCount={pageCount}
          filterKey={filterKey}
        />

        <MobileParticles />
        <MobileCameraControls />
      </Canvas>

      {/* Hint text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),24px)] flex justify-center">
        <span className="font-mono text-[10px] lowercase tracking-[2px] text-white/20">
          drag to look around · pinch to zoom
        </span>
      </div>
    </div>
  )
}
