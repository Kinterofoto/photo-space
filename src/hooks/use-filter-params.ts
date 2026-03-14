"use client"

import { useState, useCallback } from "react"
import { useSearchParams, usePathname } from "next/navigation"

export function useFilterParams() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [event, setEventState] = useState<string | null>(
    searchParams.get("event")
  )
  const [personId, setPersonIdState] = useState<string | null>(
    searchParams.get("person")
  )

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const qs = params.toString()
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname]
  )

  const setEvent = useCallback(
    (ev: string | null) => {
      setEventState(ev)
      updateUrl({ event: ev })
    },
    [updateUrl]
  )

  const setPerson = useCallback(
    (pid: string | null) => {
      setPersonIdState(pid)
      updateUrl({ person: pid ? pid.slice(0, 8) : null })
    },
    [updateUrl]
  )

  return { event, personId, setEvent, setPerson }
}
