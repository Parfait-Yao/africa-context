import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import { TrackView } from "@/components/contexts/track-view"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangleIcon, DownloadIcon, ExternalLinkIcon, GitCompareArrowsIcon, RefreshCwIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { StatusBadge } from "@/components/contexts/status-badge"
import { InstallCommand } from "@/components/contexts/install-command"
import { CopyButton } from "@/components/contexts/copy-button"
import { Markdown } from "@/components/contexts/markdown"
import { ProofCompare } from "@/components/contexts/proof-compare"
import { VoteButtons } from "@/components/contexts/vote-buttons"
import { ReportDialog } from "@/components/contexts/report-dialog"
import { contextService } from "@/modules/contexts/context.service"
import { getSession } from "@/modules/auth/session"
import { FORMAT_META, renderContext, targetFileName } from "@/modules/contexts/context.formats"
import { EXPORT_FORMATS } from "@/modules/contexts/context.types"
import { extractEnvVars } from "@/modules/contexts/install-plan"
import { CONTEXT_TYPE_LABELS, TOOL_LABELS, categoryLabel, countryName } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"

export async function generateMetadata({ params }: PageProps<"/contexts/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const ctx = await contextService.getBySlug(slug)
  if (!ctx) return { title: "Contexte introuvable" }
  return { title: ctx.title, description: ctx.description }
}

export default function ContextPage({ params }: PageProps<"/contexts/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ContextDetail params={params} />
    </Suspense>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page space-y-6 py-12">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

async function ContextDetail({ params }: Pick<PageProps<"/contexts/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const [ctx, user] = await Promise.all([contextService.getBySlug(slug), getSession()])
  if (!ctx) notFound()

  const raw = renderContext(ctx, "raw")

  return (
    <div className="container-page py-8 lg:py-12">
      <TrackView slug={ctx.slug} />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/contexts">Catalogue</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/contexts?q=${encodeURIComponent(ctx.service)}`}>{ctx.service}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem className="hidden sm:inline-flex"><BreadcrumbPage>{ctx.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ctx.status} />
          <span className="font-mono text-xs text-muted-foreground">{CONTEXT_TYPE_LABELS[ctx.type]}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{ctx.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{ctx.description}</p>
      </header>

      {ctx.status === "to_recheck" && (
        <Alert className="mt-6 max-w-3xl border-warning/40 bg-warning-soft text-warning">
          <RefreshCwIcon />
          <AlertTitle>Ce contexte doit être revérifié</AlertTitle>
          <AlertDescription className="text-warning/90">
            La documentation source a changé ou un signalement est ouvert. Vérifiez les endpoints sur la source officielle avant de l'utiliser.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs defaultValue="content">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="content">Contexte</TabsTrigger>
              <TabsTrigger value="proof">
                Preuve {ctx.proofs.length > 0 && <GitCompareArrowsIcon className="text-success" />}
              </TabsTrigger>
              <TabsTrigger value="install">Installer</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-6">
              <div className="mb-4 flex justify-end">
                <CopyButton value={raw} trackSlug={ctx.slug} label="Copier le contexte" size="sm" successMessage="Contexte copié" />
              </div>
              <Markdown>{ctx.content}</Markdown>
            </TabsContent>

            <TabsContent value="proof" className="mt-6">
              {ctx.proofs.length > 0 ? (
                <div className="space-y-10">
                  {ctx.proofs.map((p) => <ProofCompare key={p.id} proof={p} />)}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="font-medium">Pas encore de preuve avant / après pour ce contexte.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Une preuve compare la sortie de l'IA sans puis avec le contexte, sur le même prompt.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="install" className="mt-6 space-y-8">
              <section>
                <h2 className="text-lg font-semibold">En une commande</h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  Choisissez votre environnement, copiez la commande et lancez-la dans votre projet : tout ce dont votre agent a besoin est installé.
                  Votre framework est détecté automatiquement, et aucun fichier n'est remplacé sans votre accord.
                </p>
                <InstallCommand slug={ctx.slug} showFormats envVars={extractEnvVars(ctx.content).map((v) => v.name)} />
              </section>
              <section>
                <h2 className="text-lg font-semibold">Exports par outil</h2>
                <ul className="mt-4 divide-y rounded-xl border">
                  {EXPORT_FORMATS.map((f) => (
                    <li key={f} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{FORMAT_META[f].label}</p>
                        <p className="text-sm text-muted-foreground">
                          {FORMAT_META[f].description} <code className="font-mono text-xs">{targetFileName(f, ctx.slug)}</code>
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={`/api/contexts/${ctx.slug}/raw?format=${f}`} target="_blank" rel="noopener">
                          <DownloadIcon /> Ouvrir
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
              {ctx.type === "mcp_server" && (
                <Alert>
                  <AlertTriangleIcon />
                  <AlertTitle>À vérifier avant d'installer</AlertTitle>
                  <AlertDescription>AfriContext affiche l'URL du serveur MCP mais ne l'exécute jamais. Relisez sa provenance avant de l'ajouter à votre IDE.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <ol className="relative space-y-6 border-l pl-6">
                {ctx.versions.map((v, i) => (
                  <li key={v.id} className="relative">
                    <span className={`absolute top-1.5 -left-[1.82rem] size-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} aria-hidden />
                    <p className="font-medium">{v.note}</p>
                    <p className="text-sm text-muted-foreground"><time dateTime={v.createdAt}>{formatDate(v.createdAt)}</time></p>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Informations du contexte">
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-3 text-sm font-semibold">Installer</p>
            <InstallCommand slug={ctx.slug} />
            <div className="mt-4 flex items-center justify-between">
              <VoteButtons slug={ctx.slug} up={ctx.stats.upvotes} down={ctx.stats.downvotes} signedIn={Boolean(user)} />
              <ReportDialog slug={ctx.slug} signedIn={Boolean(user)} />
            </div>
          </div>

          <dl className="divide-y rounded-xl border bg-card text-sm">
            <Meta label="Source officielle">
              <a href={ctx.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Documentation <ExternalLinkIcon className="size-3.5" />
              </a>
            </Meta>
            <Meta label="Version d'API"><span className="font-mono">{ctx.apiVersion}</span></Meta>
            <Meta label="Vérifié le"><time dateTime={ctx.lastVerifiedAt}>{formatDate(ctx.lastVerifiedAt)}</time></Meta>
            <Meta label="Testé avec">{ctx.testedWith.length ? ctx.testedWith.map((t) => TOOL_LABELS[t]).join(", ") : "—"}</Meta>
            <Meta label="Catégorie">{categoryLabel(ctx.category)}</Meta>
            <Meta label="Pays">{ctx.countries.map(countryName).join(", ")}</Meta>
            <Meta label="Auteur">{ctx.author.name}</Meta>
            <Meta label="Usage">
              {formatNumber(ctx.stats.installs)} installations, {formatNumber(ctx.stats.copies)} copies
            </Meta>
          </dl>

          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {ctx.tags.map((t) => (
              <li key={t}>
                <Link href={`/contexts?tag=${t}`} className="inline-flex h-7 items-center rounded-full border px-2.5 text-xs text-muted-foreground hover:text-foreground">#{t}</Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
