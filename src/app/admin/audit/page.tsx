import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { LockIcon, ScrollTextIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditFiltersSchema, auditService } from "@/modules/audit/audit.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"

export const metadata: Metadata = { title: "Journal d'audit" }

const OUTCOMES = {
  success: { label: "Réussie", variant: "secondary" as const },
  refused: { label: "Refusée", variant: "outline" as const },
  error: { label: "Erreur", variant: "destructive" as const },
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })

/** Détails JSON lisibles : une ligne par clé, valeurs courtes. */
function DetailList({ details }: { details: unknown }) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null
  const entries = Object.entries(details as Record<string, unknown>).filter(([k, v]) => v !== null && v !== undefined && k !== "backfilled")
  if (entries.length === 0) return null
  const show = (v: unknown) => (typeof v === "object" ? JSON.stringify(v) : String(v))
  return (
    <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium">{k}</dt>
          <dd className="font-mono [overflow-wrap:anywhere]">{show(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <>
      <AdminPageHeader title="Journal d'audit" description="Opérations sensibles de l'administration : qui, quoi, sur quelle cible, quand, avec quel résultat." />
      <p className="mb-6 flex gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Journal en ajout seul : la base de données refuse toute modification ou suppression d'une entrée. Aucun mot de passe, jeton ni secret n'y est
          enregistré. Les décisions de modération antérieures à ce journal ont été reprises ; les autres actions sont tracées depuis sa mise en place.
          Heures en UTC.
        </span>
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function AuditContent({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/audit")
  const params = pickParams(await searchParams)
  const f = auditFiltersSchema.parse(params)
  const result = await auditService.list(f)

  return (
    <>
      <FilterBar
        action="/admin/audit"
        values={params}
        fields={[
          { kind: "search", name: "target", label: "Cible (identifiant ou nom)", placeholder: "slug, nom, identifiant…" },
          { kind: "select", name: "category", label: "Domaine", options: Object.entries(AUDIT_CATEGORIES).map(([value, label]) => ({ value, label })) },
          { kind: "select", name: "outcome", label: "Résultat", options: Object.entries(OUTCOMES).map(([value, o]) => ({ value, label: o.label })) },
          { kind: "search", name: "actor", label: "Acteur", placeholder: "Nom de l'administrateur" },
          { kind: "date", name: "from", label: "Du" },
          { kind: "date", name: "to", label: "Au" },
        ]}
      />
      {result.items.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ScrollTextIcon /></EmptyMedia>
            <EmptyTitle>Aucune entrée</EmptyTitle>
            <EmptyDescription>Rien ne correspond à ces filtres.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="divide-y rounded-xl border bg-card text-sm">
          {result.items.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.actorName}</span>
                  <span>{AUDIT_ACTIONS[e.action as keyof typeof AUDIT_ACTIONS] ?? e.action}</span>
                  <Badge variant={OUTCOMES[e.outcome].variant}>{OUTCOMES[e.outcome].label}</Badge>
                </p>
                {(e.targetLabel || e.targetId) && (
                  <p className="text-muted-foreground [overflow-wrap:anywhere]">
                    Cible : {e.targetLabel ?? e.targetId}
                    {e.targetLabel && e.targetId && e.targetId !== e.targetLabel && <span className="font-mono text-xs"> ({e.targetId})</span>}
                  </p>
                )}
                <DetailList details={e.details} />
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.createdAt.toISOString()}>{dateTime.format(e.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
      <AdminPagination basePath="/admin/audit" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
