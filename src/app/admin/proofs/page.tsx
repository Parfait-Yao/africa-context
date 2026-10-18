import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { z } from "zod"
import { CircleCheckIcon, FlaskConicalIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { SandboxChecks, SandboxResult, readSandboxReport } from "@/components/admin/sandbox-result"
import { proofsService } from "@/modules/proofs/proofs.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Preuves et tests" }

const filtersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  result: z.enum(["passed", "failed", "none"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})

export default function ProofsPage({ searchParams }: PageProps<"/admin/proofs">) {
  return (
    <>
      <AdminPageHeader
        title="Preuves et tests"
        description="Preuves avant / après et exécutions sandbox réellement enregistrées. Rien n'est recalculé ni simulé ici."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ProofsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function ProofsContent({ searchParams }: Pick<PageProps<"/admin/proofs">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/proofs")
  const params = pickParams(await searchParams)
  const f = filtersSchema.parse(params)
  const [coverage, result] = await Promise.all([proofsService.coverage(), proofsService.listAdmin(f)])

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Contextes publiés avec preuve</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">
            {formatNumber(coverage.withProof)} <span className="text-base font-normal text-muted-foreground">/ {formatNumber(coverage.publishedCount)}</span>
          </dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Preuves enregistrées</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(coverage.proofs)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Exécutions sandbox réussies</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-success">{formatNumber(coverage.passed)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Exécutions sandbox échouées</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-destructive">{formatNumber(coverage.failed)}</dd>
        </div>
      </dl>

      <section aria-labelledby="proofs-title">
        <h2 id="proofs-title" className="mb-3 text-lg font-semibold">Preuves</h2>
        <FilterBar
          action="/admin/proofs"
          values={params}
          fields={[
            { kind: "search", name: "q", label: "Contexte ou service", placeholder: "wave, orange-money…" },
            {
              kind: "select",
              name: "result",
              label: "Résultat sandbox",
              options: [
                { value: "passed", label: "Réussie" },
                { value: "failed", label: "Échouée" },
                { value: "none", label: "Non exécutée" },
              ],
            },
          ]}
        />
        {result.items.length === 0 ? (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FlaskConicalIcon /></EmptyMedia>
              <EmptyTitle>Aucune preuve</EmptyTitle>
              <EmptyDescription>
                Les preuves se capturent avec <code className="font-mono">npm run proof:capture -- &lt;slug&gt; &quot;&lt;prompt&gt;&quot; [--sandbox wave]</code>.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {result.items.map((p) => {
              const report = readSandboxReport(p.sandboxReport)
              const failed = report?.checks.filter((c) => !c.ok) ?? []
              return (
                <li key={p.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/contexts/${p.context.slug}`} className="font-medium hover:underline">{p.context.title}</Link>
                    <SandboxResult result={p.sandboxResult} />
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-muted-foreground">Capturée le</dt><dd>{formatDate(p.createdAt.toISOString())}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Modèle</dt><dd className="[overflow-wrap:anywhere]">{p.model}</dd></div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Version d'API testée</dt>
                      <dd>
                        {p.apiVersion ?? <span className="text-muted-foreground">non enregistrée</span>}
                        {p.apiVersion && p.apiVersion !== p.context.apiVersion && (
                          <span className="ml-1 text-xs text-warning">(contexte actuel : {p.context.apiVersion})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Source documentaire</dt>
                      <dd className="truncate"><a href={p.context.sourceUrl} target="_blank" rel="noreferrer noopener" className="hover:underline">{p.context.sourceUrl.replace(/^https?:\/\//, "")}</a></dd>
                    </div>
                  </dl>
                  <p className="line-clamp-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Prompt : </span>{p.prompt}</p>
                  {report ? (
                    <SandboxChecks report={report} open={failed.length > 0} />
                  ) : (
                    p.sandboxResult && <p className="text-xs text-muted-foreground">Détail des vérifications non conservé (preuve capturée avant leur enregistrement).</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <AdminPagination basePath="/admin/proofs" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
      </section>

      <section aria-labelledby="untested-title" className="rounded-xl border bg-card p-5">
        <h2 id="untested-title" className="text-base font-semibold">Contextes publiés sans preuve</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(coverage.publishedCount - coverage.withProof)} contexte(s) publié(s) n'ont jamais été testés par AfriContext. Les plus anciens :
        </p>
        {coverage.untested.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CircleCheckIcon className="size-4 text-success" aria-hidden="true" /> Tous les contextes publiés ont au moins une preuve.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {coverage.untested.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/admin/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                <span className="text-xs text-muted-foreground">{c.service} · {c.apiVersion} · vérifié le {formatDate(c.lastVerifiedAt.toISOString())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
