"use client"

import { useEffect, useState } from "react"
import { Github } from "lucide-react"

const REPO_URL = "https://github.com/Kinterofoto/photo-space"
const REPO_API = "https://api.github.com/repos/Kinterofoto/photo-space"

export function GithubBadge() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    fetch(REPO_API)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stargazers_count != null) setStars(data.stargazers_count)
      })
      .catch(() => {})
  }, [])

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] lowercase tracking-wider text-white/40 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/60 active:scale-95"
    >
      <Github className="h-3.5 w-3.5" />
      {stars !== null && (
        <span className="flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3 w-3 text-amber-500"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {stars}
        </span>
      )}
      {stars === null && <span>github</span>}
    </a>
  )
}
