"use client"

import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdminAction } from "./use-admin-action"

/** Relance la veille sur une URL source. Une page modifiée fait passer les contextes publiés « à revérifier ». */
export function SourceCheckButton({ url }: { url: string }) {
  const { run, pending } = useAdminAction()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Vérifier maintenant ${url}`}
      onClick={() => run("/api/admin/sources/check", { method: "POST", body: { url } }, "Vérification terminée")}
    >
      <RefreshCwIcon className={pending ? "animate-spin" : undefined} /> {pending ? "Vérification…" : "Vérifier"}
    </Button>
  )
}
