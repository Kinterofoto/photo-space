"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Canvas, extend, useThree, useFrame } from "@react-three/fiber"
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

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.3}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={0.5}
        panSpeed={0.5}
        zoomSpeed={0.7}
        minDistance={1}
        maxDistance={6}
      />
    </>
  )
}

export function SplatViewer({ plyUrl, photoName, onClose }: SplatViewerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [sparkReady, setSparkReady] = useState(sparkExtended)
  const [loadError, setLoadError] = useState<string | null>(null)
  const resetRef = useRef<(() => void) | null>(null)

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

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col transition-all duration-250",
        isVisible ? "bg-black" : "bg-transparent pointer-events-none"
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* Top bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 transition-all duration-300",
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
      <div className="flex-1">
        {loadError ? (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-sm text-white/30">{loadError}</span>
          </div>
        ) : !sparkReady ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-white/10 border-t-white/50" />
          </div>
        ) : (
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: false }}
          >
            <SplatScene plyUrl={plyUrl} onResetRef={resetRef} />
          </Canvas>
        )}
      </div>

      {/* Hint text */}
      <div
        className={cn(
          "pb-[env(safe-area-inset-bottom,16px)] text-center transition-all duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="font-mono text-[10px] lowercase tracking-wider text-white/15">
          drag to rotate · pinch to zoom
        </span>
      </div>
    </div>
  )
}
