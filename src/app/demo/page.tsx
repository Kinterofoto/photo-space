"use client"

import { useState } from "react"
import { SplatViewer } from "@/components/splat-viewer"

export default function DemoPage() {
  const [showViewer, setShowViewer] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="mb-4 font-mono text-lg lowercase tracking-wider text-white/60">
        3d gaussian splat demo
      </h1>
      <button
        onClick={() => setShowViewer(true)}
        className="rounded-full border border-white/20 bg-white/10 px-6 py-3 font-mono text-sm lowercase tracking-wider text-white/60 transition-colors hover:bg-white/15"
      >
        open 3d viewer
      </button>

      {showViewer && (
        <SplatViewer
          plyUrl="/demo/sample.splat"
          photoName="demo-nike.splat"
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  )
}
