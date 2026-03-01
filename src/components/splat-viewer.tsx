"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import * as THREE from "three"

let sparkExtended = false
let SparkRendererClass: any = null
let SplatMeshClass: any = null

interface SplatViewerProps {
  plyUrl: string
  photoName: string
  onClose: () => void
}

const INITIAL_CAM = new THREE.Vector3(0, 0, 3)
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0)

type DownloadPhase = "connecting" | "downloading" | "done"

function usePlyDownload(plyUrl: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<DownloadPhase>("connecting")
  const [progress, setProgress] = useState(0) // 0-100 if total known, -1 if unknown
  const [downloadedMB, setDownloadedMB] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function download() {
      try {
        const res = await fetch(plyUrl, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        if (cancelled) return
        setPhase("downloading")

        const contentLength = res.headers.get("content-length")
        const total = contentLength ? parseInt(contentLength, 10) : 0
        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        if (total === 0 && !cancelled) setProgress(-1) // indeterminate

        const chunks: Uint8Array[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          if (!cancelled) {
            setDownloadedMB(received / (1024 * 1024))
            if (total > 0) {
              setProgress(Math.round((received / total) * 100))
            }
          }
        }

        if (cancelled) return

        const blob = new Blob(chunks as BlobPart[])
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setPhase("done")
        setProgress(100)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Download failed")
      }
    }

    download()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [plyUrl])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  return { blobUrl, phase, progress, downloadedMB, error }
}

function SplatScene({ plyUrl, onResetRef }: { plyUrl: string; onResetRef: React.MutableRefObject<(() => void) | null> }) {
  const { gl, scene, camera } = useThree()
  const sparkRef = useRef<any>(null)
  const splatRef = useRef<any>(null)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (!SparkRendererClass || !SplatMeshClass) return

    const spark = new SparkRendererClass({ renderer: gl })
    // COLMAP → Three.js: flip Y-down to Y-up (rotate π on X)
    spark.rotation.set(Math.PI, 0, 0)
    scene.add(spark)
    sparkRef.current = spark

    const splat = new SplatMeshClass({ url: plyUrl })
    spark.add(splat)
    splatRef.current = splat

    return () => {
      scene.remove(spark)
      spark.dispose?.()
      splat.dispose?.()
    }
  }, [gl, scene, plyUrl])

  // Expose reset function
  useEffect(() => {
    onResetRef.current = () => {
      if (controlsRef.current) {
        camera.position.copy(INITIAL_CAM)
        controlsRef.current.target.copy(INITIAL_TARGET)
        controlsRef.current.update()
      }
    }
  }, [camera, onResetRef])

  // Scale pan/rotate speed inversely with distance so it stays fast when zoomed in
  useFrame(() => {
    if (!controlsRef.current) return
    const dist = camera.position.distanceTo(controlsRef.current.target)
    const baseDist = 3
    const scale = Math.max(baseDist / Math.max(dist, 0.01), 1)
    controlsRef.current.panSpeed = 2 * scale
    controlsRef.current.rotateSpeed = 0.4 * scale
  })

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        enableDamping={true}
        dampingFactor={0.08}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        panSpeed={2}
        rotateSpeed={0.4}
        zoomSpeed={3}
        minDistance={0}
        maxDistance={20}
      />
    </>
  )
}

function isTouchDevice() {
  if (typeof window === "undefined") return false
  return "ontouchstart" in window || navigator.maxTouchPoints > 0
}

export function SplatViewer({ plyUrl, photoName, onClose }: SplatViewerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [sparkReady, setSparkReady] = useState(sparkExtended)
  const [loadError, setLoadError] = useState<string | null>(null)
  const resetRef = useRef<(() => void) | null>(null)

  // Pre-fetch .ply with progress
  const { blobUrl, phase, progress, downloadedMB, error: downloadError } = usePlyDownload(plyUrl)

  useEffect(() => {
    if (sparkExtended) {
      setSparkReady(true)
      return
    }

    import("@sparkjsdev/spark")
      .then((mod) => {
        SparkRendererClass = mod.SparkRenderer
        SplatMeshClass = mod.SplatMesh
        sparkExtended = true
        setSparkReady(true)
      })
      .catch((err) => {
        setLoadError("Failed to load 3D renderer")
        console.error("Spark load error:", err)
      })
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true))
    })
  }, [])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleClose])

  const isTouch = isTouchDevice()
  const isDownloading = !blobUrl && !downloadError
  const combinedError = loadError || downloadError

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col transition-all duration-250",
        isVisible ? "bg-black" : "bg-transparent pointer-events-none"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top bar */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,12px),12px)] transition-all duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="font-mono text-[10px] lowercase tracking-wider text-white/30">
          3d view
        </span>
        <span className="max-w-[40%] truncate font-mono text-[10px] lowercase tracking-wider text-white/20">
          {photoName}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => resetRef.current?.()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/60"
            title="center view"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative min-h-0 flex-1">
        {combinedError ? (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-sm text-white/30">{combinedError}</span>
          </div>
        ) : !sparkReady || !blobUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            {phase === "connecting" ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
                <span className="font-mono text-[10px] lowercase tracking-wider text-white/20">
                  connecting to server...
                </span>
              </>
            ) : (
              <>
                {/* Progress ring */}
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    {progress >= 0 ? (
                      <circle
                        cx="32" cy="32" r="28" fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                        className="transition-all duration-300"
                      />
                    ) : (
                      <circle
                        cx="32" cy="32" r="28" fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="20 156"
                        className="animate-spin origin-center"
                        style={{ animationDuration: "1.5s" }}
                      />
                    )}
                  </svg>
                  <span className="absolute font-mono text-xs tabular-nums text-white/40">
                    {progress >= 0 ? `${progress}%` : `${downloadedMB.toFixed(0)}mb`}
                  </span>
                </div>
                <span className="font-mono text-[10px] lowercase tracking-wider text-white/20">
                  downloading 3d model...
                </span>
              </>
            )}
          </div>
        ) : (
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            dpr={[1, isTouch ? 1.5 : 2]}
            gl={{ antialias: false }}
            style={{ width: "100%", height: "100%", touchAction: "none" }}
          >
            <SplatScene plyUrl={blobUrl} onResetRef={resetRef} />
          </Canvas>
        )}
      </div>

      {/* Hint text */}
      <div
        className={cn(
          "shrink-0 pb-[max(env(safe-area-inset-bottom,16px),16px)] text-center transition-all duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="font-mono text-[10px] lowercase tracking-wider text-white/15">
          {isTouch
            ? "drag to move · pinch to zoom · two fingers to rotate"
            : "drag to move · scroll to zoom · right-click to rotate"}
        </span>
      </div>
    </div>
  )
}
