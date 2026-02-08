"use client"

import { useState, useEffect, type ReactNode } from "react"
import { MobileGallery } from "@/components/mobile/mobile-gallery"

export function MobileGate({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    setChecked(true)
  }, [])

  if (!checked) return null

  if (isMobile) {
    return <MobileGallery />
  }

  return <>{children}</>
}
