"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PersonWithFace } from "@/hooks/use-persons"

interface PersonNameDialogProps {
  person: PersonWithFace | null
  onSubmit: (id: string, name: string) => void
  onClose: () => void
}

export function PersonNameDialog({
  person,
  onSubmit,
  onClose,
}: PersonNameDialogProps) {
  const [name, setName] = useState("")
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (person) {
      setName(person.name || "")
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true)
          inputRef.current?.focus()
        })
      })
    } else {
      setVisible(false)
    }
  }, [person])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!person || !name.trim()) return
    onSubmit(person.id, name.trim())
    handleClose()
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  if (!person) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center transition-colors duration-200",
        visible ? "bg-black/60" : "bg-transparent pointer-events-none"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-t-2xl border-t border-white/[0.06] bg-zinc-950 px-6 pb-[env(safe-area-inset-bottom,24px)] pt-6 transition-transform duration-200",
          visible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] lowercase tracking-[3px] text-white/40">
            name this person
          </span>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-white/30 active:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="enter name..."
            className="flex-1 rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 font-mono text-sm lowercase text-white/80 placeholder:text-white/20 focus:border-white/15 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-xl bg-white/10 px-5 py-3 font-mono text-[11px] lowercase tracking-wider text-white/60 transition-colors active:bg-white/15 disabled:opacity-30"
          >
            save
          </button>
        </form>
      </div>
    </div>
  )
}
