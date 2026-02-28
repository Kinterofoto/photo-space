"use client"

import { useState } from "react"
import { SplatViewer } from "@/components/splat-viewer"

const demos = [
  { url: "/demo/sharp_test.ply", name: "tu foto en 3d (sharp)" },
  { url: "/demo/sample.splat", name: "nike shoe (sample)" },
]

export default function DemoPage() {
  const [active, setActive] = useState<number | null>(null)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
      <h1 className="mb-2 font-mono text-lg lowercase tracking-wider text-white/60">
        3d gaussian splat demo
      </h1>
      {demos.map((d, i) => (
        <button
          key={i}
          onClick={() => setActive(i)}
          className="rounded-full border border-white/20 bg-white/10 px-6 py-3 font-mono text-sm lowercase tracking-wider text-white/60 transition-colors hover:bg-white/15"
        >
          {d.name}
        </button>
      ))}

      {active !== null && (
        <SplatViewer
          plyUrl={demos[active].url}
          photoName={demos[active].name}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
