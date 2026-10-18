import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { z } from "zod"
import { FlagIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusBadge } from "@/components/contexts/status-badge"
import { ReportActions } from "@/components/admin/report-actions"
import { reportsService, REPORT_REASONS } from "@/modules/reports/reports.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/config/site"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Signalements" }

const filtersSchema = z.object({
  // Par défaut : les signalements ouverts ; « all » affiche tout l'historique
  status: z.enum(["open", "resolved", "dismissed", "all"]).default("open").catch("open"),
  reason: z.enum(REPORT_REASONS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <>
      <AdminPageHeader
        title="Signalements"
        description="Problèmes signalés par la communauté sur les contextes publiés. Traiter un signalement ne change pas le contexte, sauf « Marquer à revérifier »."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function ReportsContent({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/reports")
  const params = pickParams(await searchParams)
  const f = filtersSchema.parse(params)
  const result = await reportsService.listAdmin({ status: f.status === "all" ? undefined : f.status, reason: f.reason, page: f.page })

  return (
    <>
      <FilterBar
        action="/admin/reports"
        values={params}
        fields={[
          {
            kind: "select",
            name: "status",
            label: "Statut du signalement",
            allLabel: "Ouverts",
            options: [
              { value: "resolved", label: REPORT_STATUS_LABELS.resolved },
              { value: "dismissed", label: REPORT_STATUS_LABELS.dismissed },
              { value: "all", label: "Tous" },
            ],
          },
          { kind: "select", name: "reason", label: "Motif", options: REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABELS[r] })) },
        ]}
      />
      {result.items.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FlagIcon /></EmptyMedia>
            <EmptyTitle>{f.status === "open" ? "Aucun signalement ouvert" : "Aucun signalement"}</EmptyTitle>
            <EmptyDescription>Rien ne correspond à ces filtres.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {result.items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/contexts/${r.context.slug}`} className="font-medium hover:underline">{r.context.title}</Link>
                  <span className="text-xs text-muted-foreground">contexte :</span>
                  <StatusBadge status={r.context.status} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{REPORT_STATUS_LABELS[r.status]}</Badge>
                  <span className="font-medium">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>
                  {r.details && <span className="[overflow-wrap:anywhere]">— {r.details}</span>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signalé par <Link href={`/admin/users/${r.user.id}`} className="hover:underline">{r.user.name}</Link>, le {formatDate(r.createdAt.toISOString())}
                </p>
                {r.status !== "open" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Décision : {REPORT_STATUS_LABELS[r.status]}
                    {r.resolvedBy ? ` par ${r.resolvedBy.name}` : ""}
                    {r.resolvedAt ? `, le ${formatDate(r.resolvedAt.toISOString())}` : ""}
                    {r.resolutionNote ? ` — ${r.resolutionNote}` : ""}
                  </p>
                )}
              </div>
              {r.status === "open" && <ReportActions id={r.id} contextPublished={r.context.status === "approved"} />}
            </li>
          ))}
        </ul>
      )}
      <AdminPagination basePath="/admin/reports" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
