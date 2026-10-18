import { CircleAlertIcon, CircleCheckIcon, MinusCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface SandboxCheck {
  name: string
  ok: boolean
  detail?: string
}

/** Rapport sandbox stocké en JSON (script proof:capture) : on ne lit que la forme attendue. */
export function readSandboxReport(value: unknown): { scenario?: string; checks: SandboxCheck[] } | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { checks?: unknown }).checks)) return null
  const v = value as { scenario?: unknown; checks: unknown[] }
  return {
    scenario: typeof v.scenario === "string" ? v.scenario : undefined,
    checks: v.checks
      .filter((c): c is SandboxCheck => Boolean(c) && typeof (c as SandboxCheck).name === "string")
      .map((c) => ({ name: c.name, ok: Boolean(c.ok), detail: typeof c.detail === "string" ? c.detail : undefined })),
  }
}

export function SandboxResult({ result }: { result: string | null }) {
  if (result === "passed") return <Badge variant="outline" className="border-success/40 text-success"><CircleCheckIcon /> Sandbox réussie</Badge>
  if (result === "failed") return <Badge variant="outline" className="border-destructive/40 text-destructive"><CircleAlertIcon /> Sandbox échouée</Badge>
  return <Badge variant="outline" className="text-muted-foreground"><MinusCircleIcon /> Non exécutée</Badge>
}

export function SandboxChecks({ report, open }: { report: { scenario?: string; checks: SandboxCheck[] }; open?: boolean }) {
  const passed = report.checks.filter((c) => c.ok).length
  return (
    <details className="text-sm" open={open}>
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Vérifications sandbox{report.scenario ? ` (scénario ${report.scenario})` : ""} : {passed}/{report.checks.length} réussies
      </summary>
      <ul className="mt-2 space-y-1">
        {report.checks.map((c, i) => (
          <li key={i} className="flex gap-2">
            {c.ok ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-label="Réussi" />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Échoué" />
            )}
            <span className="[overflow-wrap:anywhere]">
              {c.name}
              {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
