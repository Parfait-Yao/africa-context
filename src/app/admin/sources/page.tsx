import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { FileSearchIcon, InfoIcon, RefreshCwIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { FilterBar } from "@/components/admin/filter-bar"
import { SourceCheckButton } from "@/components/admin/source-check-button"
import { StatusBadge } from "@/components/contexts/status-badge"
import { sourcesService, sourceFiltersSchema, STALE_AFTER_HOURS, type SourceState } from "@/modules/watch/sources.service"
import { settingsService } from "@/modules/settings/settings.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Vérification de la documentation" }

const STATES: Record<SourceState, { label: string; className: string; hint: string }> = {
  unreachable: { label: "Injoignable", className: "border-destructive/40 bg-destructive/10 text-destructive", hint: "La page n'a pas pu être lue." },
  changed: { label: "Modifiée", className: "border-warning/40 bg-warning-soft text-warning", hint: "Le texte de la page a changé depuis le contrôle précédent." },
  stale: { label: "Contrôle ancien", className: "border-warning/40 bg-warning-soft text-warning", hint: `Pas de contrôle depuis plus de ${STALE_AFTER_HOURS} h : la tâche planifiée tourne-t-elle ?` },
  never: { label: "Jamais contrôlée", className: "text-muted-foreground", hint: "Publiée, mais la veille n'est pas encore passée." },
  baseline: { label: "Référence enregistrée", className: "border-success/40 text-success", hint: "Premier contrôle : l'empreinte sert de référence." },
  unchanged: { label: "Inchangée", className: "border-success/40 text-success", hint: "Identique au contrôle précédent." },
  unwatched: { label: "Non surveillée", className: "text-muted-foreground", hint: "Aucun contexte publié n'utilise cette source." },
}

export default function SourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  return (
    <>
      <AdminPageHeader
        title="Vérification de la documentation"
        description="Fraîcheur des sources documentaires, d'après la veille automatique (tâche planifiée quotidienne)."
      />
      <p className="mb-6 flex gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          La veille télécharge la page source et compare une empreinte de son texte. Elle détecte qu'une page a changé ou ne répond plus,
          pas ce qui a changé ni si le contexte est encore exact : la relecture reste humaine. Une page générée en JavaScript ou protégée par
          authentification ne peut pas être lue, et une page dynamique peut signaler de faux changements.
        </span>
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SourcesContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function SourcesContent({ searchParams }: Pick<PageProps<"/admin/sources">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/sources")
  const params = pickParams(await searchParams)
  const f = sourceFiltersSchema.parse(params)
  const [{ rows, counts, total, toReview }, maxFailures] = await Promise.all([sourcesService.list(f), settingsService.get("watch.maxFailures")])

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sources", value: total },
          { label: "Injoignables", value: counts.unreachable },
          { label: "Modifiées", value: counts.changed },
          { label: "Contrôle ancien ou absent", value: counts.stale + counts.never },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(s.value)}</dd>
          </div>
        ))}
      </dl>

      {toReview.length > 0 && (
        <section aria-labelledby="todo-title" className="rounded-xl border border-warning/40 bg-warning-soft p-5">
          <h2 id="todo-title" className="font-semibold">Vérifications à effectuer</h2>
          <p className="mt-1 text-sm">Contextes passés « à revérifier » par la veille : relisez la documentation, corrigez si besoin, puis republiez depuis la fiche.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {toReview.map((c) => (
              <li key={c.slug}>
                <Link href={`/admin/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                <span className="text-muted-foreground"> — {c.sourceCheckResult === "changed" ? "documentation modifiée" : `source injoignable (${c.sourceCheckFailures} échec(s))`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sources-title">
        <h2 id="sources-title" className="mb-3 text-lg font-semibold">Sources</h2>
        <FilterBar
          action="/admin/sources"
          values={params}
          fields={[
            { kind: "search", name: "q", label: "URL ou contexte", placeholder: "docs.wave.com…" },
            { kind: "select", name: "state", label: "État", options: Object.entries(STATES).map(([value, s]) => ({ value, label: s.label })) },
          ]}
        />
        {rows.length === 0 ? (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileSearchIcon /></EmptyMedia>
              <EmptyTitle>Aucune source</EmptyTitle>
              <EmptyDescription>Rien ne correspond à ces filtres.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {rows.map((r) => {
              const st = STATES[r.state]
              return (
                <li key={r.url} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                      <a href={r.url} target="_blank" rel="noreferrer noopener" className="font-medium [overflow-wrap:anywhere] hover:underline">{r.url.replace(/^https?:\/\//, "")}</a>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {st.hint}
                      {r.lastCheckedAt && ` Dernier contrôle : ${formatDate(r.lastCheckedAt.toISOString())}.`}
                      {r.failures > 0 && ` ${r.failures} échec(s) consécutif(s) sur ${maxFailures} avant revérification.`}
                    </p>
                    {r.error && <p className="font-mono text-xs [overflow-wrap:anywhere] text-destructive">Erreur : {r.error}</p>}
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {r.contexts.map((c) => (
                        <li key={c.slug} className="flex items-center gap-1.5">
                          <Link href={`/admin/contexts/${c.slug}`} className="hover:underline">{c.title}</Link>
                          <StatusBadge status={c.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  {r.state !== "unwatched" ? (
                    <SourceCheckButton url={r.url} />
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><RefreshCwIcon className="size-3" aria-hidden="true" /> Vérifiée après publication</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
