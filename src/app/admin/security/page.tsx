import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { CircleCheckIcon, InfoIcon, ShieldAlertIcon, UserRoundSearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { AlertActions, ScanButton } from "@/components/admin/security-actions"
import { securityService, alertFiltersSchema, UNUSUAL_THRESHOLDS } from "@/modules/security/security.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sécurité" }

const KIND_LABELS = { secret: "Secret potentiel", suspicious_url: "URL suspecte", malformed_content: "Contenu invalide" } as const
const SEVERITY = {
  high: { label: "Élevée", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  medium: { label: "Moyenne", className: "border-warning/40 bg-warning-soft text-warning" },
  low: { label: "Faible", className: "text-muted-foreground" },
} as const
const STATUS_LABELS = { open: "À traiter", acknowledged: "Prise en charge", resolved: "Résolue", false_positive: "Faux positif" } as const

export default function SecurityPage({ searchParams }: PageProps<"/admin/security">) {
  return (
    <>
      <AdminPageHeader
        title="Sécurité"
        description="Alertes issues de l'analyse automatique des contributions : secrets, URL suspectes, contenus invalides."
      >
        <ScanButton />
      </AdminPageHeader>
      <p className="mb-6 flex gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          La détection repose sur des règles (expressions régulières) : elle peut produire des faux positifs et manquer certains secrets.
          Ces alertes aident à la relecture, elles ne garantissent pas l'absence de risque. Les valeurs détectées ne sont jamais affichées en entier.
        </span>
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SecurityContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function SecurityContent({ searchParams }: Pick<PageProps<"/admin/security">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/security")
  const params = pickParams(await searchParams)
  const f = alertFiltersSchema.parse(params)
  const [summary, result, unusual, blocked] = await Promise.all([
    securityService.summary(),
    securityService.list(f),
    securityService.unusualActivity(),
    securityService.validationFailures({ blockedOnly: true, page: 1 }, 8),
  ])

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Alertes actives", value: summary.active, tone: summary.active > 0 },
          { label: "dont gravité élevée", value: summary.high, tone: summary.high > 0 },
          { label: "Résolues", value: summary.resolved },
          { label: "Faux positifs", value: summary.falsePositives },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={cn("mt-1 text-2xl font-bold tabular-nums", s.tone && "text-destructive")}>{formatNumber(s.value)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="alerts-title">
        <h2 id="alerts-title" className="mb-3 text-lg font-semibold">Alertes</h2>
        <FilterBar
          action="/admin/security"
          values={params}
          fields={[
            { kind: "search", name: "q", label: "Contexte (slug)", placeholder: "wave-checkout…" },
            {
              kind: "select",
              name: "status",
              label: "Statut",
              allLabel: "Actives",
              options: [...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })), { value: "all", label: "Toutes" }],
            },
            { kind: "select", name: "kind", label: "Type", options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })) },
            { kind: "select", name: "severity", label: "Gravité", allLabel: "Toutes", options: Object.entries(SEVERITY).map(([value, s]) => ({ value, label: s.label })) },
          ]}
        />
        {result.items.length === 0 ? (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">{f.status === "active" ? <CircleCheckIcon /> : <ShieldAlertIcon />}</EmptyMedia>
              <EmptyTitle>{f.status === "active" ? "Aucune alerte active" : "Aucune alerte"}</EmptyTitle>
              <EmptyDescription>
                {f.status === "active"
                  ? "Rien à traiter pour ces filtres. Lancez une analyse pour vérifier les contenus déjà enregistrés."
                  : "Rien ne correspond à ces filtres."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {result.items.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={SEVERITY[a.severity].className}>{SEVERITY[a.severity].label}</Badge>
                    <Badge variant="secondary">{KIND_LABELS[a.kind]}</Badge>
                    <span className="font-medium">{a.label}</span>
                  </div>
                  <p className="text-sm">
                    {a.contextId ? (
                      <Link href={`/admin/contexts/${a.contextSlug}`} className="font-medium hover:underline">{a.context?.title ?? a.contextSlug}</Link>
                    ) : (
                      <span className="font-medium">{a.contextSlug} <span className="font-normal text-muted-foreground">(contexte supprimé)</span></span>
                    )}
                    <span className="text-muted-foreground"> · {a.location}</span>
                  </p>
                  <p className="max-w-full font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground">
                    <span className="sr-only">Extrait expurgé : </span>{a.excerpt}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABELS[a.status]} · détectée le {formatDate(a.firstSeenAt.toISOString())}
                    {a.lastSeenAt.getTime() !== a.firstSeenAt.getTime() && `, revue le ${formatDate(a.lastSeenAt.toISOString())}`}
                    {a.resolvedAt && ` · close le ${formatDate(a.resolvedAt.toISOString())}${a.resolvedBy ? ` par ${a.resolvedBy.name}` : " automatiquement"}`}
                    {a.resolutionNote && ` — ${a.resolutionNote}`}
                    {" · "}
                    <Link href={`/admin/audit?target=${a.id}`} className="underline-offset-2 hover:underline">historique</Link>
                  </p>
                </div>
                <AlertActions id={a.id} status={a.status} label={a.label} />
              </li>
            ))}
          </ul>
        )}
        <AdminPagination basePath="/admin/security" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="blocked-title" className="rounded-xl border bg-card p-5">
          <h2 id="blocked-title" className="text-base font-semibold">Soumissions bloquées pour secret</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le contenu refusé n'est pas conservé : seules la règle déclenchée et l'auteur sont enregistrés.{" "}
            <Link href="/admin/stats" className="underline-offset-2 hover:underline">Toutes les erreurs de validation</Link>
          </p>
          {blocked.items.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune soumission bloquée enregistrée.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {blocked.items.map((b) => (
                <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    {b.user ? <Link href={`/admin/users/${b.user.id}`} className="font-medium hover:underline">{b.user.name}</Link> : <span>Compte supprimé</span>}
                    <span className="text-muted-foreground"> · {b.action === "submit" ? "soumission" : "correction"}{b.slug ? ` de ${b.slug}` : ""} · </span>
                    <span className="font-mono text-xs">{b.secretRules.join(", ")}</span>
                  </span>
                  <time className="text-xs text-muted-foreground" dateTime={b.createdAt.toISOString()}>{formatDate(b.createdAt.toISOString())}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="unusual-title" className="rounded-xl border bg-card p-5">
          <h2 id="unusual-title" className="text-base font-semibold">Activité inhabituelle (7 jours)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comptes qui dépassent un seuil indicatif : {UNUSUAL_THRESHOLDS.secretBlocks} blocages pour secret, {UNUSUAL_THRESHOLDS.validationFailures} soumissions refusées,{" "}
            {UNUSUAL_THRESHOLDS.reports} signalements ou {UNUSUAL_THRESHOLDS.submissions} contextes soumis. Un signal invite à regarder, il ne prouve rien.
          </p>
          {unusual.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 text-success" aria-hidden="true" /> Aucun compte au-dessus des seuils.
            </p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {unusual.map((s) => (
                <li key={`${s.userId}-${s.kind}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <UserRoundSearchIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <Link href={`/admin/users/${s.userId}`} className="font-medium hover:underline">{s.user?.name ?? "Compte inconnu"}</Link>
                    {s.user?.suspendedAt && <Badge variant="secondary">Suspendu</Badge>}
                  </span>
                  <span className="text-muted-foreground">
                    {s.label} : <span className="font-semibold text-foreground tabular-nums">{s.count}</span> (seuil {s.threshold})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
