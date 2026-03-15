"use client"

import { useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useSplatStatus, useGenerateSplat } from "@/hooks/use-splat"
import { SplatViewer } from "./splat-viewer"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Generate3DButtonProps {
  photoName: string
  className?: string
  size?: "sm" | "md"
}

export function Generate3DButton({
  photoName,
  className,
  size = "sm",
}: Generate3DButtonProps) {
  const { data: splatData } = useSplatStatus(photoName)
  const generateSplat = useGenerateSplat()
  const [showViewer, setShowViewer] = useState(false)

  const status = splatData?.status ?? "none"

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()

      if (status === "ready" && splatData && "plyUrl" in splatData && splatData.plyUrl) {
        setShowViewer(true)
        return
      }

      if (status === "none" || status === "error") {
        generateSplat.mutate(photoName, {
          onError: (err) => {
            toast.error(err.message || "3D generation failed")
          },
        })
      }
    },
    [status, splatData, photoName, generateSplat]
  )

  const label =
    status === "ready"
      ? "3d"
      : status === "error"
        ? "retry"
        : status === "processing" || status === "pending"
          ? ""
          : "3d"

  const isLoading =
    status === "processing" || status === "pending" || generateSplat.isPending

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "rounded-full border font-mono lowercase tracking-wider transition-all",
          size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]",
          status === "ready"
            ? "border-white/20 bg-white/10 text-white/60 hover:bg-white/15"
            : "border-white/[0.06] bg-black/50 text-white/25 hover:text-white/40",
          isLoading && "animate-pulse",
          className
        )}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 animate-spin rounded-full border border-white/20 border-t-white/50" />
          </span>
        ) : (
          label
        )}
      </button>

      {showViewer && splatData && "plyUrl" in splatData && splatData.plyUrl &&
        createPortal(
          <SplatViewer
            plyUrl={`/api/splats/ply?photo_name=${encodeURIComponent(photoName)}`}
            photoName={photoName}
            onClose={() => setShowViewer(false)}
          />,
          document.body
        )}
    </>
  )
}
