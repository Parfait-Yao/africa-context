"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

/**
 * Appel d'une route /api/admin : message d'erreur du serveur affiché tel quel, rafraîchissement
 * des données serveur en cas de succès. Renvoie `true` si l'action a réussi.
 */
export function useAdminAction() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const run = React.useCallback(
    async (url: string, init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown }, success: string) => {
      setPending(true)
      const res = await fetch(url, {
        method: init.method,
        headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }).catch(() => null)
      const json = await res?.json().catch(() => null)
      setPending(false)
      if (!res) {
        toast.error("Le serveur ne répond pas. Vérifiez votre connexion et réessayez.")
        return false
      }
      if (!res.ok) {
        const fieldErrors = json?.error?.details?.fieldErrors as Record<string, string[]> | undefined
        const first = fieldErrors && Object.values(fieldErrors).flat()[0]
        toast.error(json?.error?.message ? `${json.error.message}${first ? ` ${first}` : ""}` : "Action refusée par le serveur.")
        return false
      }
      toast.success(success)
      router.refresh()
      return true
    },
    [router]
  )

  return { run, pending }
}
