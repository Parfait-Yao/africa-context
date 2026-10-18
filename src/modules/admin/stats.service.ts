import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import type { ContextStatus } from "@/modules/contexts/context.types"
import { settingsService } from "@/modules/settings/settings.service"

/**
 * Statistiques de l'administration, calculées à partir des tables (aucune donnée inventée).
 * Seule `estimate.hoursSaved` est une estimation, fondée sur un paramètre documenté.
 */

export const PERIODS = {
  "7d": { label: "7 derniers jours", days: 7, unit: "day" },
  "30d": { label: "30 derniers jours", days: 30, unit: "day" },
  "90d": { label: "90 derniers jours", days: 90, unit: "week" },
  "12m": { label: "12 derniers mois", days: 365, unit: "month" },
  all: { label: "Depuis le début", days: null, unit: "month" },
} as const
export type Period = keyof typeof PERIODS

export const statsFiltersSchema = z.object({
  period: z.enum(Object.keys(PERIODS) as [Period, ...Period[]]).default("30d").catch("30d"),
})

type Unit = "day" | "week" | "month"

/** Début de l'intervalle contenant `d` (UTC, semaines commençant le lundi comme date_trunc). */
function truncate(d: Date, unit: Unit) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), unit === "month" ? 1 : d.getUTCDate()))
  if (unit === "week") t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7))
  return t
}

function step(d: Date, unit: Unit) {
  const t = new Date(d)
  if (unit === "day") t.setUTCDate(t.getUTCDate() + 1)
  else if (unit === "week") t.setUTCDate(t.getUTCDate() + 7)
  else t.setUTCMonth(t.getUTCMonth() + 1)
  return t
}

/** Série complète (intervalles vides inclus) à partir des lignes agrégées par date_trunc. */
function fillSeries(rows: { bucket: Date; n: number }[], since: Date, unit: Unit) {
  const map = new Map(rows.map((r) => [truncate(new Date(r.bucket), unit).getTime(), r.n]))
  const out: { start: string; value: number }[] = []
  const end = truncate(new Date(), unit).getTime()
  for (let t = truncate(since, unit); t.getTime() <= end && out.length < 400; t = step(t, unit)) {
    out.push({ start: t.toISOString(), value: map.get(t.getTime()) ?? 0 })
  }
  return out
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const statsService = {
  async compute(period: Period) {
    const conf = PERIODS[period]
    const unit: Unit = conf.unit
    let since: Date
    if (conf.days) since = new Date(Date.now() - conf.days * 24 * 3600 * 1000)
    else {
      const first = await prisma.context.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } })
      since = first?.createdAt ?? new Date()
    }
    const inPeriod = { gte: since }

    const [
      byStatus, users, firstContributions, newVersions, events, contributionRows, eventRows,
      failures, failureRows, reportsCreated, reportsClosed, serviceUsage, topContexts, minutesPerUse, oldestFailure,
    ] = await Promise.all([
      prisma.context.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.count(),
      prisma.context.groupBy({ by: ["authorId"], _min: { createdAt: true } }),
      prisma.contextVersion.count({ where: { createdAt: inPeriod, note: "Correction après relecture" } }),
      prisma.event.groupBy({ by: ["kind"], where: { createdAt: inPeriod }, _count: { _all: true } }),
      prisma.$queryRaw<{ bucket: Date; n: number }[]>`
        SELECT date_trunc(${unit}, "createdAt") AS bucket, count(*)::int AS n
        FROM "Context" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ bucket: Date; n: number }[]>`
        SELECT date_trunc(${unit}, "createdAt") AS bucket, count(*)::int AS n
        FROM "Event" WHERE "createdAt" >= ${since} AND kind IN ('copy', 'install') GROUP BY 1 ORDER BY 1`,
      prisma.validationFailure.findMany({ where: { createdAt: inPeriod }, select: { fields: true, missingSections: true, secretRules: true } }),
      prisma.$queryRaw<{ bucket: Date; n: number }[]>`
        SELECT date_trunc(${unit}, "createdAt") AS bucket, count(*)::int AS n
        FROM "ValidationFailure" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.report.groupBy({ by: ["reason"], where: { createdAt: inPeriod }, _count: { _all: true } }),
      prisma.report.findMany({ where: { resolvedAt: inPeriod }, select: { status: true, createdAt: true, resolvedAt: true } }),
      prisma.$queryRaw<{ service: string; kind: string; n: number }[]>`
        SELECT c.service, e.kind::text AS kind, count(*)::int AS n
        FROM "Event" e JOIN "Context" c ON c.id = e."contextId"
        WHERE e."createdAt" >= ${since} GROUP BY 1, 2`,
      prisma.$queryRaw<{ slug: string; title: string; n: number }[]>`
        SELECT c.slug, c.title, count(*)::int AS n
        FROM "Event" e JOIN "Context" c ON c.id = e."contextId"
        WHERE e."createdAt" >= ${since} AND e.kind IN ('copy', 'install')
        GROUP BY 1, 2 ORDER BY n DESC, c.slug LIMIT 10`,
      settingsService.get("impact.minutesSavedPerUse"),
      prisma.validationFailure.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ])

    const status = (s: ContextStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0
    const ev = (k: string) => events.find((e) => e.kind === k)?._count._all ?? 0

    // Services : usages (copies + installations) et consultations sur la période
    const services = new Map<string, { views: number; uses: number }>()
    for (const r of serviceUsage) {
      const s = services.get(r.service) ?? { views: 0, uses: 0 }
      if (r.kind === "view") s.views += r.n
      else s.uses += r.n
      services.set(r.service, s)
    }
    const topServices = [...services.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.uses - a.uses || b.views - a.views || a.name.localeCompare(b.name))
      .slice(0, 10)

    const resolutionHours = reportsClosed.filter((r) => r.resolvedAt).map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000)
    const uses = ev("copy") + ev("install")

    return {
      period,
      since,
      unit,
      snapshot: {
        contexts: byStatus.reduce((n, b) => n + b._count._all, 0),
        published: status("approved") + status("to_recheck"),
        pending: status("pending"),
        toRecheck: status("to_recheck"),
        rejected: status("rejected"),
        contributors: firstContributions.length,
        users,
      },
      activity: {
        newContexts: contributionRows.reduce((n, r) => n + r.n, 0),
        corrections: newVersions,
        newContributors: firstContributions.filter((c) => c._min.createdAt && c._min.createdAt >= since).length,
        views: ev("view"),
        copies: ev("copy"),
        installs: ev("install"),
      },
      series: {
        contributions: fillSeries(contributionRows, since, unit),
        uses: fillSeries(eventRows, since, unit),
        failures: fillSeries(failureRows, since, unit),
      },
      validation: {
        total: failures.length,
        fields: failures.filter((f) => f.fields.length > 0).length,
        sections: failures.filter((f) => f.missingSections > 0).length,
        secrets: failures.filter((f) => f.secretRules.length > 0).length,
        // Le suivi des échecs n'existe que depuis la migration de la partie 3
        trackedSince: oldestFailure?.createdAt ?? null,
      },
      reports: {
        created: reportsCreated.reduce((n, r) => n + r._count._all, 0),
        byReason: reportsCreated.map((r) => ({ reason: r.reason, count: r._count._all })).sort((a, b) => b.count - a.count),
        resolved: reportsClosed.filter((r) => r.status === "resolved").length,
        dismissed: reportsClosed.filter((r) => r.status === "dismissed").length,
        medianHours: median(resolutionHours),
      },
      topServices,
      topContexts,
      estimate: { uses, minutesPerUse, hoursSaved: Math.round((uses * minutesPerUse) / 60) },
    }
  },
}

export type Stats = Awaited<ReturnType<typeof statsService.compute>>
