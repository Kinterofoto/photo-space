"use client"

import { useRef } from "react"
import { usePersons, type PersonWithFace } from "@/hooks/use-persons"
import { cn } from "@/lib/utils"

interface PeopleStripProps {
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  onTapUnnamed: (person: PersonWithFace) => void
}

function PersonAvatar({ person }: { person: PersonWithFace }) {
  const thumb = person.representativeFace?.thumbnail
  if (!thumb) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/5 text-[10px] text-white/30">
        ?
      </div>
    )
  }

  return (
    <img
      src={thumb}
      alt=""
      className="h-full w-full object-cover"
      draggable={false}
    />
  )
}

export function PeopleStrip({
  selectedPersonId,
  onSelectPerson,
  onTapUnnamed,
}: PeopleStripProps) {
  const { data: persons, isLoading } = usePersons()
  const scrollRef = useRef<HTMLDivElement>(null)

  if (isLoading || !persons || persons.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* All pill */}
      <button
        onClick={() => onSelectPerson(null)}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] lowercase tracking-wider transition-colors",
          selectedPersonId === null
            ? "border-white/20 bg-white/10 text-white/60"
            : "border-white/[0.06] text-white/25 active:bg-white/5"
        )}
      >
        all
      </button>

      {/* Person circles */}
      {persons.map((person) => {
        const isSelected = selectedPersonId === person.id
        return (
          <div key={person.id} className="relative flex shrink-0 flex-col items-center gap-1">
            <button
              onClick={() =>
                onSelectPerson(isSelected ? null : person.id)
              }
              className="flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  "h-12 w-12 overflow-hidden rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-white/30"
                    : "border-white/[0.06]"
                )}
              >
                <PersonAvatar person={person} />
              </div>
              <span
                className={cn(
                  "max-w-[52px] truncate font-mono text-[9px] lowercase tracking-wide",
                  isSelected
                    ? "text-white/50"
                    : "text-white/20"
                )}
              >
                {person.name || `face ${person.faceCount}`}
              </span>
            </button>
            {/* Tag/rename button — visible when selected */}
            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTapUnnamed(person)
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/40 active:bg-white/20"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-2.5 w-2.5">
                  <path d="M7 2l3 3-6 6H1V8z" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
