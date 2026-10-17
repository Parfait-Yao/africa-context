import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { ExternalLinkIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/contexts/status-badge"
import { ModerationReview, type ReviewData } from "@/components/admin/moderation-review"
import { ReportActions } from "@/components/admin/report-actions"
import { contextService } from "@/modules/contexts/context.service"
import { reportsService } from "@/modules/reports/reports.service"
import { getSession } from "@/modules/auth/session"
import { REQUIRED_SECTIONS, checkSections } from "@/modules/spec/spec.schema"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { CONTEXT_TYPE_LABELS, STATUS_LABELS } from "@/config/site"
import type { Context } from "@/modules/contexts/context.types"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Modération" }

export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <AdminContent />
    </Suspense>
  )
}

function toReview(c: Context): ReviewData {
  const { present } = checkSections(c.content)
  return {
    slug: c.slug,
    title: c.title,
    status: c.status,
    sourceUrl: c.sourceUrl,
    author: c.author.name,
    content: c.content,
    sections: REQUIRED_SECTIONS.map((s) => ({ title: s.title, ok: present.includes(s.key) })),
    secrets: scanForSecrets(c.content).map(({ label, excerpt, line }) => ({ label, excerpt, line })),
  }
}

/** Rendu à la requête : les statuts changent après chaque décision. */
async function AdminContent() {
  await connection()
  const user = await getSession()
  if (user?.role !== "admin") redirect("/dashboard")

  const [items, reports, log] = await Promise.all([
    contextService.listForModeration(),
    reportsService.listOpen(),
    contextService.moderationLog(20),
  ])
  const pending = items.filter((c) => c.status === "pending")
  const recheck = items.filter((c) => c.status === "to_recheck")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Modération</h1>
        <p className="mt-1 text-muted-foreground">Vérifiez chaque soumission sur sa documentation officielle avant de l'approuver.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="pending">En attente <Badge variant="secondary">{pending.length}</Badge></TabsTrigger>
          <TabsTrigger value="recheck">À revérifier <Badge variant="secondary">{recheck.length}</Badge></TabsTrigger>
          <TabsTrigger value="reports">Signalements <Badge variant="secondary">{reports.length}</Badge></TabsTrigger>
          <TabsTrigger value="log">Journal</TabsTrigger>
        </TabsList>

        {[{ value: "pending", rows: pending }, { value: "recheck", rows: recheck }].map(({ value, rows }) => (
          <TabsContent key={value} value={value} className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Contexte</TableHead>
                    <TableHead className="hidden md:table-cell">Auteur</TableHead>
                    <TableHead className="hidden md:table-cell">Soumis le</TableHead>
                    <TableHead className="pr-5 text-right">Décision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Rien à traiter pour l'instant.</TableCell></TableRow>
                  )}
                  {rows.map((c) => (
                    <TableRow key={c.slug}>
                      <TableCell className="max-w-[16rem] pl-5 whitespace-normal">
                        <p className="font-medium">{c.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{CONTEXT_TYPE_LABELS[c.type]}</span>
                          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Source <ExternalLinkIcon className="size-3" />
                          </a>
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{c.author.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(c.createdAt)}</TableCell>
                      <TableCell className="pr-5 text-right"><ModerationReview data={toReview(c)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="reports" className="mt-4">
          {reports.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Aucun signalement ouvert.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/contexts/${r.context.slug}`} className="font-medium hover:underline">{r.context.title}</Link>
                      <StatusBadge status={r.context.status} />
                    </div>
                    <p className="mt-1 text-sm"><span className="font-medium">{r.reason}</span>{r.details ? ` — ${r.details}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Signalé par {r.user.name}, le {formatDate(r.createdAt.toISOString())}</p>
                  </div>
                  <ReportActions id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {log.length === 0 && <li className="p-6 text-center text-muted-foreground">Aucune décision pour l'instant.</li>}
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                <span>
                  <span className="font-medium">{l.admin.name}</span> : {STATUS_LABELS[l.fromStatus]} → <span className="font-medium">{STATUS_LABELS[l.toStatus]}</span> ·{" "}
                  <Link href={`/contexts/${l.context.slug}`} className="hover:underline">{l.context.title}</Link>
                  {l.reason && <span className="text-muted-foreground"> — {l.reason}</span>}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={l.createdAt.toISOString()}>{formatDate(l.createdAt.toISOString())}</time>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  )
}
