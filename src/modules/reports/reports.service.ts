import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError as BusinessError } from "@/lib/errors"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"

export const REPORT_REASONS = ["obsolete", "incorrect", "dangerous", "secret", "other"] as const
export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
})

/** Au-delà de ce nombre de signalements ouverts, le contexte passe automatiquement « à revérifier ». */
export const AUTO_RECHECK_THRESHOLD = 3

export const reportsService = {
  async create(slug: string, userId: string, input: unknown) {
    const data = reportSchema.parse(input)
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true, status: true } })
    // Seuls les contextes publiés sont signalables (ne pas révéler ni cibler les brouillons d'autrui)
    if (!ctx || !PUBLIC_STATUSES.includes(ctx.status)) throw new BusinessError(404, "Contexte introuvable.")

    const already = await prisma.report.findFirst({ where: { contextId: ctx.id, userId, status: "open" } })
    if (already) throw new BusinessError(409, "Vous avez déjà un signalement ouvert sur ce contexte.")

    const report = await prisma.report.create({
      data: { contextId: ctx.id, userId, reason: data.reason, details: data.details || null },
    })
    const open = await prisma.report.count({ where: { contextId: ctx.id, status: "open" } })
    let autoRecheck = false
    if (open >= AUTO_RECHECK_THRESHOLD && ctx.status === "approved") {
      await prisma.context.update({ where: { id: ctx.id }, data: { status: "to_recheck" } })
      autoRecheck = true
    }
    return { id: report.id, status: report.status, autoRecheck }
  },

  listOpen: () =>
    prisma.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: { context: { select: { slug: true, title: true, status: true } }, user: { select: { name: true } } },
    }),

  async resolve(id: string, action: "recheck" | "dismiss") {
    const report = await prisma.report.findUnique({ where: { id }, include: { context: { select: { id: true, status: true } } } })
    if (!report) throw new BusinessError(404, "Signalement introuvable.")
    await prisma.report.update({
      where: { id },
      data: { status: action === "dismiss" ? "dismissed" : "resolved", resolvedAt: new Date() },
    })
    if (action === "recheck" && report.context.status === "approved") {
      await prisma.context.update({ where: { id: report.context.id }, data: { status: "to_recheck" } })
    }
    return { id, status: action === "dismiss" ? "dismissed" : "resolved" }
  },
}
