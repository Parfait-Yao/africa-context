import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { BoxIcon, CircleCheckIcon, CircleXIcon, ConstructionIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { SandboxChecks, SandboxResult, readSandboxReport } from "@/components/admin/sandbox-result"
import { proofsService } from "@/modules/proofs/proofs.service"
import { requireAdminPage } from "@/modules/auth/session"
import { prisma } from "@/lib/db"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Sandboxes" }

export default function SandboxesPage() {
  return (
    <>
      <AdminPageHeader title="Sandboxes" description="Suivi des exécutions de code contre les API simulées (Wave, Orange Money, FedaPay)." />
      <section aria-labelledby="isolation-title" className="mb-6 rounded-xl border border-warning/40 bg-warning-soft p-5">
        <h2 id="isolation-title" className="flex items-center gap-2 font-semibold">
          <ConstructionIcon className="size-4 text-warning" aria-hidden="true" /> Exécution depuis l'interface : à développer
        </h2>
        <div className="mt-2 space-y-2 text-sm">
          <p>
            L'application n'exécute jamais de code soumis par les utilisateurs. Les exécutions affichées ici sont lancées par un opérateur, en ligne de commande, avec{" "}
            <code className="font-mono text-xs">npm run proof:capture -- &lt;slug&gt; &quot;&lt;prompt&gt;&quot; --sandbox wave|orange|fedapay</code>.
          </p>
          <p>
            Le runner actuel (<code className="font-mono text-xs">sandbox/run.mjs</code>) lance un processus Node séparé : 128 Mo de mémoire, 15 s maximum, environnement vidé,
            appels <code className="font-mono text-xs">fetch</code> redirigés vers les API simulées et processus enfants bloqués. Ce n'est pas une isolation suffisante pour du code
            arbitraire : il tourne sur la même machine, sans conteneur ni filtrage des appels système, et les modules réseau bas niveau ne sont pas bloqués.
          </p>
          <p>
            Prérequis avant d'ouvrir l'exécution depuis l'interface : un environnement dédié et éphémère (conteneur ou micro-VM), sans réseau hors API simulées,
            sans secrets, avec quotas CPU / mémoire / durée, et une file d'attente séparée du serveur web.
          </p>
        </div>
      </section>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <SandboxesContent />
      </Suspense>
    </>
  )
}

async function SandboxesContent() {
  await connection()
  await requireAdminPage("/admin/sandboxes")
  const [runs, flagged, coverage] = await Promise.all([
    proofsService.sandboxRuns(30),
    prisma.context.findMany({ where: { hasSandbox: true }, select: { slug: true, title: true, service: true, status: true }, orderBy: { title: "asc" } }),
    proofsService.coverage(),
  ])
  const configured = Boolean(process.env.SANDBOX_URL)

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Serveur d'API simulées</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-semibold">
            {configured ? <CircleCheckIcon className="size-4 text-success" aria-hidden="true" /> : <CircleXIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
            {configured ? "SANDBOX_URL définie" : "SANDBOX_URL non définie"}
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">Configuration du déploiement, non vérifiée en direct</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Contextes avec scénario sandbox</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(flagged.length)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Exécutions réussies</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-success">{formatNumber(coverage.passed)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Exécutions échouées</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-destructive">{formatNumber(coverage.failed)}</dd>
        </div>
      </dl>

      <section aria-labelledby="runs-title">
        <h2 id="runs-title" className="mb-3 text-lg font-semibold">Dernières exécutions enregistrées</h2>
        {runs.length === 0 ? (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon"><BoxIcon /></EmptyMedia>
              <EmptyTitle>Aucune exécution enregistrée</EmptyTitle>
              <EmptyDescription>Les exécutions apparaissent ici quand une preuve est capturée avec l'option --sandbox.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {runs.map((r) => {
              const report = readSandboxReport(r.sandboxReport)
              return (
                <li key={r.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <Link href={`/admin/contexts/${r.context.slug}`} className="font-medium hover:underline">{r.context.title}</Link>
                      <span className="text-sm text-muted-foreground"> · {r.model} · {formatDate(r.createdAt.toISOString())}</span>
                    </span>
                    <SandboxResult result={r.sandboxResult} />
                  </div>
                  {report ? (
                    <SandboxChecks report={report} open={r.sandboxResult === "failed"} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Détail des vérifications non conservé pour cette exécution.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-sm"><Link href="/admin/proofs" className="underline-offset-2 hover:underline">Toutes les preuves et tests</Link></p>
      </section>

      <section aria-labelledby="flagged-title" className="rounded-xl border bg-card p-5">
        <h2 id="flagged-title" className="text-base font-semibold">Contextes marqués « sandbox disponible »</h2>
        {flagged.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun contexte n'est marqué comme disposant d'un scénario sandbox.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {flagged.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/admin/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                <span className="text-xs text-muted-foreground">{c.service}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
