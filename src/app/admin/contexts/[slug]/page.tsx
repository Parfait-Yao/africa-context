import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckList } from "@/components/admin/check-list"
import { ContextActions } from "@/components/admin/context-actions"
import { ReportActions } from "@/components/admin/report-actions"
import { Markdown } from "@/components/contexts/markdown"
import { StatusBadge } from "@/components/contexts/status-badge"
import { adminContextsService } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { summarizeChecks } from "@/modules/spec/context-checks"
import { CONTEXT_TYPE_LABELS, REPORT_REASON_LABELS, REPORT_STATUS_LABELS, STATUS_LABELS, TOOL_LABELS, categoryLabel, countryName } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Fiche contexte" }

export default function AdminContextPage({ params }: PageProps<"/admin/contexts/[slug]">) {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/contexts"><ArrowLeftIcon /> Tous les contextes</Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <ContextDetail params={params} />
      </Suspense>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

async function ContextDetail({ params }: Pick<PageProps<"/admin/contexts/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  await requireAdminPage(`/admin/contexts/${slug}`)
  const data = await adminContextsService.detail(slug)
  if (!data) notFound()
  const { context: c, extra, checks, versions, reports, history } = data
  const summary = summarizeChecks(checks)
  const published = c.status === "approved" || c.status === "to_recheck"
  const openReports = reports.filter((r) => r.status === "open").length

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          <Badge variant="outline">{CONTEXT_TYPE_LABELS[c.type]}</Badge>
          {published && (
            <Link href={`/contexts/${c.slug}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Voir la fiche publique <ExternalLinkIcon className="size-3" />
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{c.description}</p>
        {c.status === "rejected" && c.rejectionReason && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm">
            <span className="font-medium">Motif communiqué au contributeur :</span> {c.rejectionReason}
          </p>
        )}
        <ContextActions slug={c.slug} title={c.title} status={c.status} publishBlocked={summary.blocking} />
        {summary.blocking && (c.status === "pending" || c.status === "to_recheck") && (
          <p className="text-sm text-muted-foreground">Publication bloquée : sections de la Spec manquantes ou secret détecté (voir la validation).</p>
        )}
        <p className="text-xs text-muted-foreground">Seul le contributeur peut modifier son contexte : en cas de problème, rejetez-le avec un motif précis pour qu'il le corrige.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue="preview" className="min-w-0">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="preview">Aperçu</TabsTrigger>
            <TabsTrigger value="source">Markdown</TabsTrigger>
            <TabsTrigger value="versions">Versions <Badge variant="secondary">{versions.length}</Badge></TabsTrigger>
            <TabsTrigger value="proofs">Preuves <Badge variant="secondary">{c.proofs.length}</Badge></TabsTrigger>
            <TabsTrigger value="reports">Signalements <Badge variant="secondary">{openReports}</Badge></TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4 rounded-xl border bg-card p-5">
            <p className="mb-4 text-xs text-muted-foreground">Aperçu tel qu'il sera affiché sur le site (HTML brut ignoré).</p>
            <Markdown>{c.content}</Markdown>
          </TabsContent>

          <TabsContent value="source" className="mt-4">
            <pre className="max-h-[70vh] overflow-auto rounded-xl bg-code-bg p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-code-fg">{c.content}</pre>
          </TabsContent>

          <TabsContent value="versions" className="mt-4 space-y-2">
            {versions.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Aucune version enregistrée.</p>}
            {versions.map((v, i) => (
              <details key={v.id} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{v.note}</span>
                    {i === 0 && <Badge variant="secondary" className="ml-2">actuelle</Badge>}
                  </span>
                  <time className="text-xs text-muted-foreground" dateTime={v.createdAt.toISOString()}>{formatDate(v.createdAt.toISOString())}</time>
                </summary>
                <pre className="max-h-96 overflow-auto border-t bg-code-bg p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-code-fg">{v.contentPayload}</pre>
              </details>
            ))}
          </TabsContent>

          <TabsContent value="proofs" className="mt-4 space-y-2">
            {c.proofs.length === 0 && (
              <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Aucune preuve enregistrée : ce contexte n'a pas été testé par AfriContext.</p>
            )}
            {c.proofs.map((p) => (
              <details key={p.id} className="rounded-xl border bg-card">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{p.model}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.sandboxResult ? `Sandbox : ${p.sandboxResult === "passed" ? "réussie" : "échouée"}` : "Pas d'exécution sandbox"} · {formatDate(p.createdAt)}
                  </span>
                </summary>
                <div className="space-y-3 border-t p-4 text-xs">
                  <p><span className="font-medium">Prompt :</span> {p.prompt}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">{p.outputWithoutContext}</pre>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">{p.outputWithContext}</pre>
                  </div>
                </div>
              </details>
            ))}
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            {reports.length === 0 ? (
              <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Aucun signalement.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p><span className="font-medium">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>{r.details ? ` — ${r.details}` : ""}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.user.name} · {formatDate(r.createdAt.toISOString())} · {REPORT_STATUS_LABELS[r.status]}
                        {r.resolvedBy && ` par ${r.resolvedBy.name}`}
                        {r.resolutionNote && ` — ${r.resolutionNote}`}
                      </p>
                    </div>
                    {r.status === "open" && <ReportActions id={r.id} contextPublished={c.status === "approved"} />}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {history.length === 0 && <li className="p-6 text-center text-muted-foreground">Aucune décision de modération.</li>}
              {history.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                  <span>
                    <span className="font-medium">{l.admin.name}</span> : {STATUS_LABELS[l.fromStatus]} → <span className="font-medium">{STATUS_LABELS[l.toStatus]}</span>
                    {l.reason && <span className="text-muted-foreground"> — {l.reason}</span>}
                  </span>
                  <time className="text-xs text-muted-foreground" dateTime={l.createdAt.toISOString()}>{formatDate(l.createdAt.toISOString())}</time>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <section aria-labelledby="validation-title">
            <h2 id="validation-title" className="mb-2 flex items-center justify-between text-base font-semibold">
              Validation technique
              <span className="text-xs font-normal text-muted-foreground">
                {summary.errors} erreur{summary.errors > 1 ? "s" : ""} · {summary.warnings} avert.
              </span>
            </h2>
            <CheckList checks={checks} />
            <p className="mt-2 text-xs text-muted-foreground">Contrôles statiques : aucun appel d'API ni exemple de code n'est exécuté.</p>
          </section>

          <Card className="gap-2 py-4">
            <CardHeader className="px-4"><CardTitle className="text-base">Fiche technique</CardTitle></CardHeader>
            <CardContent className="px-4">
              <dl className="divide-y">
                <Row label="Slug"><code className="font-mono text-xs">{c.slug}</code></Row>
                <Row label="Service">{c.service}</Row>
                <Row label="Version d'API">{c.apiVersion}</Row>
                <Row label="Catégorie">{categoryLabel(c.category)}</Row>
                <Row label="Pays">{c.countries.map(countryName).join(", ")}</Row>
                <Row label="Tags">{c.tags.length ? c.tags.join(", ") : "—"}</Row>
                <Row label="Source">
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.sourceUrl}</a>
                </Row>
                <Row label="Testé avec">{c.testedWith.length ? c.testedWith.map((t) => TOOL_LABELS[t]).join(", ") + " (déclaré)" : "—"}</Row>
                <Row label="Soumis le">{formatDate(c.createdAt)}</Row>
                <Row label="Modifié le">{formatDate(extra.updatedAt.toISOString())}</Row>
                <Row label="Vérifié le">{formatDate(c.lastVerifiedAt)}</Row>
                <Row label="Usage">{formatNumber(c.stats.views)} vues · {formatNumber(c.stats.copies)} copies · {formatNumber(c.stats.installs)} install.</Row>
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-2 py-4">
            <CardHeader className="px-4"><CardTitle className="text-base">Contributeur</CardTitle></CardHeader>
            <CardContent className="px-4">
              <dl className="divide-y">
                <Row label="Nom"><Link href={`/admin/users/${extra.author.id}`} className="font-medium hover:underline">{c.author.name}</Link></Row>
                <Row label="Email">{extra.author.email}</Row>
                <Row label="Rôle">{extra.author.role === "admin" ? "Administrateur" : "Contributeur"}{extra.author.suspendedAt && " · suspendu"}</Row>
                <Row label="Réputation">{formatNumber(extra.author.reputationScore)}</Row>
                <Row label="Contextes">{extra.author._count.contexts} soumis · {data.approvedByAuthor} publiés</Row>
                <Row label="Inscrit le">{formatDate(extra.author.createdAt.toISOString())}</Row>
                {extra.author.githubUrl && (
                  <Row label="GitHub"><a href={extra.author.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">profil</a></Row>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
