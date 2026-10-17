import { CheckCircle2Icon, XCircleIcon, FlaskConicalIcon } from "lucide-react"
import type { Proof } from "@/modules/contexts/context.types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

function Panel({ tone, title, code }: { tone: "bad" | "good"; title: string; code: string }) {
  const Icon = tone === "bad" ? XCircleIcon : CheckCircle2Icon
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-code-bg">
      <figcaption
        className={cn(
          "flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-sm font-medium",
          tone === "bad" ? "text-[#fca5a5]" : "text-[#86efac]"
        )}
      >
        <Icon className="size-4" /> {title}
      </figcaption>
      <pre className="flex-1 overflow-x-auto p-4 text-[0.8rem] leading-6 text-code-fg">
        <code>{code}</code>
      </pre>
    </figure>
  )
}

export function ProofCompare({ proof, compact = false }: { proof: Proof; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Prompt : </span>
          <span className="font-medium">« {proof.prompt} »</span>
        </div>
      )}
      <div className={cn("grid gap-3", !compact && "lg:grid-cols-2")}>
        <Panel tone="bad" title="Sans contexte" code={proof.outputWithoutContext} />
        <Panel tone="good" title="Avec le contexte AfriContext" code={proof.outputWithContext} />
      </div>
      {!compact && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Modèle : {proof.model}</span>
          <span>Capturé le {formatDate(proof.createdAt)}</span>
          {proof.sandboxResult && (
            <span className={cn("inline-flex items-center gap-1", proof.sandboxResult === "passed" ? "text-success" : "text-destructive")}>
              <FlaskConicalIcon className="size-3.5" />
              {proof.sandboxResult === "passed" ? "Test sandbox réussi" : "Test sandbox échoué"}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
