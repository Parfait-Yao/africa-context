import "server-only"
import { prisma } from "@/lib/db"
import { contextService } from "@/modules/contexts/context.service"
import { settingsService } from "@/modules/settings/settings.service"
import type { ContextStatus } from "@/modules/contexts/context.types"

/** Données réelles du tableau de bord administrateur (aucune valeur estimée hors `hoursSaved`). */
export const adminService = {
  async overview() {
    const maxFailures = await settingsService.get("watch.maxFailures")
    const [byStatus, openReports, users, admins, unreachableSources, impact, recentSubmissions, recentDecisions, openAlerts] = await Promise.all([
      prisma.context.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.report.count({ where: { status: "open" } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.context.count({ where: { status: "approved", sourceCheckFailures: { gte: maxFailures } } }),
      contextService.impact(),
      prisma.context.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { slug: true, title: true, status: true, createdAt: true, author: { select: { name: true } } },
      }),
      contextService.moderationLog(6),
      prisma.securityAlert.groupBy({ by: ["severity"], where: { status: { in: ["open", "acknowledged"] } }, _count: { _all: true } }),
    ])
    const statusCount = (s: ContextStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0

    return {
      contexts: {
        total: byStatus.reduce((n, b) => n + b._count._all, 0),
        approved: statusCount("approved"),
        pending: statusCount("pending"),
        toRecheck: statusCount("to_recheck"),
        rejected: statusCount("rejected"),
      },
      openReports,
      openAlerts: {
        total: openAlerts.reduce((n, a) => n + a._count._all, 0),
        high: openAlerts.find((a) => a.severity === "high")?._count._all ?? 0,
      },
      users,
      admins,
      unreachableSources,
      impact,
      recentSubmissions,
      recentDecisions,
    }
  },
}

export type AdminOverview = Awaited<ReturnType<typeof adminService.overview>>
