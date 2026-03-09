"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"

export function useFilterParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const event = searchParams.get("event")
  const personId = searchParams.get("person")

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  const setEvent = useCallback(
    (ev: string | null) => updateParams({ event: ev }),
    [updateParams]
  )

  const setPerson = useCallback(
    (id: string | null) => updateParams({ person: id }),
    [updateParams]
  )

  return { event, personId, setEvent, setPerson }
}
