"use client"

import { CheckIcon, EyeIcon, RotateCcwIcon, ScanSearchIcon, ShieldXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

type AlertStatus = "open" | "acknowledged" | "resolved" | "false_positive"

/** Décisions sur une alerte. Le serveur vérifie les transitions ; un faux positif doit être justifié. */
export function AlertActions({ id, status, label }: { id: string; status: AlertStatus; label: string }) {
  const { run, pending } = useAdminAction()
  const url = `/api/admin/security/alerts/${encodeURIComponent(id)}`
  const send = (to: AlertStatus, note: string, msg: string) => run(url, { method: "PATCH", body: { status: to, ...(note && { note }) } }, msg)

  if (status === "resolved" || status === "false_positive") {
    return (
      <ConfirmAction
        trigger={<Button variant="outline" size="sm" disabled={pending}><RotateCcwIcon /> Rouvrir</Button>}
        title="Rouvrir cette alerte ?"
        description={`« ${label} » repassera dans les alertes à traiter.`}
        confirmLabel="Rouvrir"
        onConfirm={() => send("open", "", "Alerte rouverte")}
        pending={pending}
      />
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "open" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => send("acknowledged", "", "Alerte prise en charge")}>
          <EyeIcon /> Prendre en charge
        </Button>
      )}
      <ConfirmAction
        trigger={<Button size="sm" disabled={pending}><CheckIcon /> Résolue</Button>}
        title="Marquer l'alerte comme résolue ?"
        description="À utiliser quand le risque a été traité : contenu corrigé, clé révoquée chez le fournisseur, lien remplacé… Si l'élément est toujours présent, la prochaine analyse le détectera de nouveau mais votre décision est conservée."
        confirmLabel="Marquer résolue"
        reason="optional"
        reasonLabel="Note interne"
        onConfirm={(note) => send("resolved", note, "Alerte résolue")}
        pending={pending}
      />
      <ConfirmAction
        trigger={<Button variant="ghost" size="sm" disabled={pending}><ShieldXIcon /> Faux positif</Button>}
        title="Classer en faux positif ?"
        description="La détection est erronée (valeur d'exemple, placeholder, lien légitime…). Indiquez pourquoi : la justification est conservée dans le journal d'audit."
        confirmLabel="Classer en faux positif"
        reason="required"
        reasonLabel="Justification"
        onConfirm={(note) => send("false_positive", note, "Alerte classée en faux positif")}
        pending={pending}
      />
    </div>
  )
}

/** Lance l'analyse de sécurité de tout le catalogue (ou d'un contexte). */
export function ScanButton({ slug, size = "default" }: { slug?: string; size?: "default" | "sm" }) {
  const { run, pending } = useAdminAction()
  return (
    <ConfirmAction
      trigger={<Button size={size} variant={slug ? "outline" : "default"} disabled={pending}><ScanSearchIcon /> {slug ? "Analyser ce contexte" : "Lancer une analyse"}</Button>}
      title={slug ? "Analyser ce contexte ?" : "Analyser tout le catalogue ?"}
      description="Recherche de secrets, d'URL suspectes, de caractères invisibles et de contenus non conformes dans les contenus, anciennes versions et preuves. Les nouvelles détections deviennent des alertes ; celles qui ne sont plus détectées sont closes automatiquement."
      confirmLabel={pending ? "Analyse…" : "Analyser"}
      onConfirm={() => run("/api/admin/security/scan", { method: "POST", body: slug ? { slug } : {} }, "Analyse terminée")}
      pending={pending}
    />
  )
}
