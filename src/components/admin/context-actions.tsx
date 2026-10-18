"use client"

import { useRouter } from "next/navigation"
import { CheckIcon, EyeOffIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ContextStatus } from "@/modules/contexts/context.types"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

/** Actions admin sur un contexte, selon son statut (les transitions sont revérifiées par le serveur). */
export function ContextActions({ slug, title, status, publishBlocked }: { slug: string; title: string; status: ContextStatus; publishBlocked: boolean }) {
  const router = useRouter()
  const { run, pending } = useAdminAction()
  const url = `/api/admin/contexts/${encodeURIComponent(slug)}`
  const moderate = (to: ContextStatus, success: string) => (reason: string) =>
    run(url, { method: "PATCH", body: { status: to, reason: reason || undefined } }, success)

  const reviewable = status === "pending" || status === "to_recheck"
  const published = status === "approved" || status === "to_recheck"

  return (
    <div className="flex flex-wrap gap-2">
      {reviewable && (
        <>
          <ConfirmAction
            trigger={<Button disabled={publishBlocked || pending}><CheckIcon /> Approuver et publier</Button>}
            title={`Publier « ${title} » ?`}
            description="Le contexte apparaîtra dans le catalogue public et pourra être installé. Vérifiez-le d'abord sur la documentation officielle."
            confirmLabel="Publier"
            onConfirm={moderate("approved", "Contexte approuvé et publié")}
            pending={pending}
          />
          <ConfirmAction
            trigger={<Button variant="outline" disabled={pending}><XIcon /> Rejeter / demander des corrections</Button>}
            title={`Rejeter « ${title} » ?`}
            description="Le contributeur verra votre motif et pourra corriger puis resoumettre son contexte, qui repassera alors en attente."
            confirmLabel="Rejeter"
            destructive
            reason="required"
            onConfirm={moderate("rejected", "Contexte rejeté : le contributeur a été informé du motif")}
            pending={pending}
          />
        </>
      )}
      {status === "approved" && (
        <>
          <ConfirmAction
            trigger={<Button variant="outline" disabled={pending}><RefreshCwIcon /> Marquer à revérifier</Button>}
            title="Marquer à revérifier ?"
            description="Le contexte reste visible dans le catalogue, avec la mention « À revérifier », et revient dans la file de modération."
            confirmLabel="Marquer à revérifier"
            reason="optional"
            onConfirm={moderate("to_recheck", "Contexte marqué à revérifier")}
            pending={pending}
          />
          <ConfirmAction
            trigger={<Button variant="outline" disabled={pending}><EyeOffIcon /> Dépublier</Button>}
            title={`Dépublier « ${title} » ?`}
            description="Le contexte est retiré du catalogue public (statut « Rejeté »). Son auteur voit le motif et peut le corriger pour le resoumettre."
            confirmLabel="Dépublier"
            destructive
            reason="required"
            onConfirm={moderate("rejected", "Contexte dépublié")}
            pending={pending}
          />
        </>
      )}
      {!published && (
        <ConfirmAction
          trigger={<Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending}><Trash2Icon /> Supprimer</Button>}
          title={`Supprimer « ${title} » définitivement ?`}
          description="Le contexte, ses versions, preuves, votes, signalements et son historique de modération seront supprimés. Cette action est irréversible."
          confirmLabel="Supprimer définitivement"
          destructive
          confirmText={slug}
          onConfirm={async () => {
            const ok = await run(url, { method: "DELETE" }, "Contexte supprimé")
            if (ok) router.push("/admin/contexts")
            return ok
          }}
          pending={pending}
        />
      )}
    </div>
  )
}
