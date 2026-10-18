import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { CalculatorIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { BarChart, RankedBars } from "@/components/admin/bar-chart"
import { statsService, statsFiltersSchema, PERIODS, type Period, type Stats } from "@/modules/admin/stats.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { REPORT_REASON_LABELS } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Statistiques et impact" }

export default function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  return (
    <>
      <AdminPageHeader title="Statistiques et impact" description="Chiffres calculés à partir des données enregistrées. Les estimations sont signalées comme telles." />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

function PeriodTabs({ current }: { current: Period }) {
  return (
    <nav aria-label="Période" className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1 sm:w-fit">
      {(Object.keys(PERIODS) as Period[]).map((p) => (
        <Link
          key={p}
          href={p === "30d" ? "/admin/stats" : `/admin/stats?period=${p}`}
          aria-current={p === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
            p === current ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {PERIODS[p].label}
        </Link>
      ))}
    </nav>
  )
}

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

async function StatsContent({ searchParams }: Pick<PageProps<"/admin/stats">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/stats")
  const { period } = statsFiltersSchema.parse(pickParams(await searchParams))
  const s = await statsService.compute(period)

  return (
    <>
      <PeriodTabs current={period} />
      <div className="space-y-8">
        <section aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="mb-3 text-lg font-semibold">Catalogue aujourd'hui</h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Contextes" value={s.snapshot.contexts} hint={`${formatNumber(s.snapshot.rejected)} rejetés`} />
            <Tile label="Publiés" value={s.snapshot.published} hint={`dont ${formatNumber(s.snapshot.toRecheck)} à revérifier`} />
            <Tile label="En attente" value={s.snapshot.pending} />
            <Tile label="Contributeurs" value={s.snapshot.contributors} hint={`sur ${formatNumber(s.snapshot.users)} comptes`} />
          </dl>
        </section>

        <section aria-labelledby="activity-title">
          <h2 id="activity-title" className="mb-3 text-lg font-semibold">
            Activité · {PERIODS[period].label.toLowerCase()}
            <span className="ml-2 text-sm font-normal text-muted-foreground">depuis le {formatDate(s.since.toISOString())}</span>
          </h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Tile label="Contributions" value={s.activity.newContexts} />
            <Tile label="Corrections" value={s.activity.corrections} />
            <Tile label="Nouveaux contributeurs" value={s.activity.newContributors} />
            <Tile label="Consultations" value={s.activity.views} hint="1 par visiteur et par jour" />
            <Tile label="Copies" value={s.activity.copies} />
            <Tile label="Installations" value={s.activity.installs} hint="CLI et MCP" />
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BarChart title="Contributions soumises" series={s.series.contributions} unit={s.unit} valueLabel="contextes" />
            <BarChart title="Copies et installations" series={s.series.uses} unit={s.unit} valueLabel="usages" />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="services-title" className="rounded-xl border bg-card p-5">
            <h2 id="services-title" className="mb-4 text-base font-semibold">Services les plus utilisés</h2>
            {s.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune consultation ni copie sur la période.</p>
            ) : (
              <RankedBars
                valueLabel="usages"
                items={s.topServices.map((t) => ({ key: t.name, label: t.name, value: t.uses, hint: `${formatNumber(t.views)} consultations` }))}
              />
            )}
          </section>
          <section aria-labelledby="top-title" className="rounded-xl border bg-card p-5">
            <h2 id="top-title" className="mb-4 text-base font-semibold">Contextes les plus copiés ou installés</h2>
            {s.topContexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune copie ni installation sur la période.</p>
            ) : (
              <RankedBars
                valueLabel="usages"
                items={s.topContexts.map((t) => ({ key: t.slug, label: <Link href={`/admin/contexts/${t.slug}`} className="hover:underline">{t.title}</Link>, value: t.n }))}
              />
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ValidationSection s={s} />
          <ReportsSection s={s} />
        </div>

        <Estimate s={s} />
      </div>
    </>
  )
}

function ValidationSection({ s }: { s: Stats }) {
  const v = s.validation
  return (
    <section aria-labelledby="validation-title" className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 id="validation-title" className="text-base font-semibold">Erreurs de validation</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Soumissions et corrections refusées.{" "}
          {v.trackedSince ? `Suivi actif depuis le ${formatDate(v.trackedSince.toISOString())}.` : "Aucune donnée : le suivi a démarré avec la mise à jour de l'administration."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Total", v.total],
            ["Champs invalides", v.fields],
            ["Sections manquantes", v.sections],
            ["Secrets bloqués", v.secrets],
          ].map(([label, n]) => (
            <div key={label as string}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold tabular-nums">{formatNumber(n as number)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Une même soumission peut cumuler plusieurs causes.</p>
      </div>
      <BarChart title="Refus par période" series={s.series.failures} unit={s.unit} valueLabel="refus" />
    </section>
  )
}

function ReportsSection({ s }: { s: Stats }) {
  const r = s.reports
  const median = r.medianHours === null ? "—" : r.medianHours < 48 ? `${Math.round(r.medianHours)} h` : `${Math.round(r.medianHours / 24)} j`
  return (
    <section aria-labelledby="reports-title" className="rounded-xl border bg-card p-5">
      <h2 id="reports-title" className="text-base font-semibold">Signalements</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Reçus", formatNumber(r.created)],
          ["Traités", formatNumber(r.resolved)],
          ["Classés", formatNumber(r.dismissed)],
          ["Délai médian", median],
        ].map(([label, n]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Délai médian entre la réception et la décision, pour les signalements clos sur la période.</p>
      {r.byReason.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-3 text-sm font-medium">Motifs</h3>
          <RankedBars valueLabel="" items={r.byReason.map((b) => ({ key: b.reason, label: REPORT_REASON_LABELS[b.reason] ?? b.reason, value: b.count }))} />
        </div>
      )}
      <Link href="/admin/reports" className="mt-4 inline-block text-sm underline-offset-2 hover:underline">Voir les signalements</Link>
    </section>
  )
}

function Estimate({ s }: { s: Stats }) {
  const e = s.estimate
  return (
    <section aria-labelledby="estimate-title" className="rounded-xl border border-dashed bg-muted/30 p-5">
      <h2 id="estimate-title" className="flex items-center gap-2 text-base font-semibold">
        <CalculatorIcon className="size-4 text-muted-foreground" aria-hidden="true" /> Temps économisé — estimation, pas une mesure
      </h2>
      <p className="mt-2 text-3xl font-bold tabular-nums">≈ {formatNumber(e.hoursSaved)} h</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Méthode : {formatNumber(e.uses)} usages mesurés (copies + installations) × {e.minutesPerUse} minutes supposées par usage ÷ 60.
        Les usages sont comptés ; les minutes par usage sont une hypothèse, réglable dans les{" "}
        <Link href="/admin/settings" className="underline-offset-2 hover:underline">paramètres</Link>. Aucun temps réel n'est mesuré
        chez les développeurs, et une copie ne garantit pas que le contexte a été utilisé.
      </p>
    </section>
  )
}
