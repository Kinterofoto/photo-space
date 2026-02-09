"use client"

import { usePersons, type PersonWithFace } from "@/hooks/use-persons"
import { useNamePerson } from "@/hooks/use-name-person"
import { PersonNameDialog } from "@/components/mobile/person-name-dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface PeopleBarProps {
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
}

function PersonAvatar({ person }: { person: PersonWithFace }) {
  const thumb = person.representativeFace?.thumbnail
  if (!thumb) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/5 font-mono text-[10px] text-white/30">
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

export function PeopleBar({ selectedPersonId, onSelectPerson }: PeopleBarProps) {
  const { data: persons, isLoading } = usePersons()
  const namePerson = useNamePerson()
  const [namingPerson, setNamingPerson] = useState<PersonWithFace | null>(null)

  if (isLoading || !persons || persons.length === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-20 w-full max-w-[min(90vw,600px)] -translate-x-1/2">
        <div className="rounded-full border border-white/[0.06] bg-black/60 backdrop-blur-xl">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-2 px-4 py-2">
              {/* All pill */}
              <button
                onClick={() => onSelectPerson(null)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] lowercase tracking-wider transition-all",
                  selectedPersonId === null
                    ? "border-white/20 bg-white/10 text-white/60"
                    : "border-transparent text-white/25 hover:text-white/40"
                )}
              >
                all
              </button>

              <div className="h-5 w-px shrink-0 bg-white/[0.06]" />

              {/* Person circles */}
              {persons.map((person) => {
                const isSelected = selectedPersonId === person.id
                return (
                  <div key={person.id} className="group relative flex shrink-0 flex-col items-center gap-1">
                    <button
                      onClick={() =>
                        onSelectPerson(isSelected ? null : person.id)
                      }
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className={cn(
                          "h-9 w-9 overflow-hidden rounded-full border-2 transition-all",
                          isSelected
                            ? "border-white/40 scale-110"
                            : "border-white/[0.06] hover:border-white/20"
                        )}
                      >
                        <PersonAvatar person={person} />
                      </div>
                      <span
                        className={cn(
                          "max-w-[48px] truncate font-mono text-[8px] lowercase tracking-wide transition-colors",
                          isSelected
                            ? "text-white/50"
                            : "text-white/15 group-hover:text-white/30"
                        )}
                      >
                        {person.name || `face ${person.faceCount}`}
                      </span>
                    </button>
                    {/* Tag/rename button — visible on hover or when selected */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setNamingPerson(person)
                      }}
                      className={cn(
                        "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-white/40 transition-opacity hover:bg-white/20 hover:text-white/60",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                      title="Name this person"
                    >
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-2.5 w-2.5">
                        <path d="M7 2l3 3-6 6H1V8z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>
      </div>

      <PersonNameDialog
        person={namingPerson}
        onSubmit={(id, name) => namePerson.mutate({ id, name })}
        onClose={() => setNamingPerson(null)}
      />
    </>
  )
}
