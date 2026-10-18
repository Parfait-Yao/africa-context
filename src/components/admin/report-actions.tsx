"use client"

import { CheckIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

/**
 * Décision sur un signalement ouvert. Le statut du signalement et celui du contexte sont distincts :
 * seule l'action « Marquer à revérifier » modifie le contexte (s'il est publié).
 */
export function ReportActions({ id, contextPublished }: { id: string; contextPublished?: boolean }) {
  const { run, pending } = useAdminAction()
  const decide = (action: "dismiss" | "resolve" | "recheck", success: string) => (note: string) =>
    run(`/api/admin/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: { action, note: note || undefined } }, success)

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <ConfirmAction
        trigger={<Button size="sm" variant="outline" disabled={pending}><XIcon /> Classer</Button>}
        title="Classer ce signalement sans suite ?"
        description="Le signalement est fermé ; le contexte n'est pas modifié."
        confirmLabel="Classer sans suite"
        reason="optional"
        onConfirm={decide("dismiss", "Signalement classé sans suite")}
        pending={pending}
      />
      <ConfirmAction
        trigger={<Button size="sm" variant="outline" disabled={pending}><CheckIcon /> Traité</Button>}
        title="Marquer ce signalement comme traité ?"
        description="À utiliser si le problème a déjà été corrigé. Le contexte n'est pas modifié."
        confirmLabel="Marquer traité"
        reason="optional"
        onConfirm={decide("resolve", "Signalement traité")}
        pending={pending}
      />
      {contextPublished !== false && (
        <ConfirmAction
          trigger={<Button size="sm" disabled={pending}><RefreshCwIcon /> Marquer à revérifier</Button>}
          title="Traiter et faire revérifier le contexte ?"
          description="Le signalement est fermé et le contexte publié passe « à revérifier » (il reste visible avec cette mention). La décision est journalisée."
          confirmLabel="Marquer à revérifier"
          reason="optional"
          onConfirm={decide("recheck", "Contexte marqué à revérifier")}
          pending={pending}
        />
      )}
    </div>
  )
}
