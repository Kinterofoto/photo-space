"use client"

import { useState, useCallback } from "react"

export function useFilterParams() {
  const [event, setEventState] = useState<string | null>(null)
  const [personId, setPersonIdState] = useState<string | null>(null)

  const setEvent = useCallback((ev: string | null) => {
    setEventState(ev)
  }, [])

  const setPerson = useCallback((id: string | null) => {
    setPersonIdState(id)
  }, [])

  return { event, personId, setEvent, setPerson }
}
