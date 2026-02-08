"use client"

import { Github } from "lucide-react"

const REPO_URL = "https://github.com/Kinterofoto/photo-space"

export function GithubBadge() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] lowercase tracking-wider text-white/40 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/60 active:scale-95"
    >
      <Github className="h-3.5 w-3.5" />
      <span>github</span>
    </a>
  )
}
