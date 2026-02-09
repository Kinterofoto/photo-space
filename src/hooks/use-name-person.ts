import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PersonWithFace } from "./use-persons"

export function useNamePerson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/persons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed to update name")
      return res.json()
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ["persons"] })
      const prev = queryClient.getQueryData<PersonWithFace[]>(["persons"])
      queryClient.setQueryData<PersonWithFace[]>(["persons"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, name } : p))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["persons"], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] })
    },
  })
}
