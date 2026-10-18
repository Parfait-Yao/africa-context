import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import type { Check, CheckLevel } from "@/modules/spec/context-checks"
import { cn } from "@/lib/utils"

const LEVELS: Record<CheckLevel, { Icon: typeof CircleCheckIcon; className: string; label: string }> = {
  ok: { Icon: CircleCheckIcon, className: "text-success", label: "Conforme" },
  warning: { Icon: TriangleAlertIcon, className: "text-warning", label: "Avertissement" },
  error: { Icon: CircleAlertIcon, className: "text-destructive", label: "Erreur" },
  info: { Icon: InfoIcon, className: "text-muted-foreground", label: "Information" },
}

/** Rapport de validation technique (AfriContext Spec + contrôles de forme). */
export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {checks.map((c) => {
        const { Icon, className, label } = LEVELS[c.level]
        return (
          <li key={c.key} className="flex gap-3 px-4 py-3 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} />
            <div className="min-w-0">
              <p className="font-medium">
                {c.label}
                {c.blocking && c.level === "error" && <span className="ml-2 text-xs font-normal text-destructive">bloque la publication</span>}
              </p>
              {c.details.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {c.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
