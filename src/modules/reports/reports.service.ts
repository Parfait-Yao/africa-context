import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError as BusinessError } from "@/lib/errors"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"
import { SETTINGS, settingsService } from "@/modules/settings/settings.service"

export const REPORT_REASONS = ["obsolete", "incorrect", "dangerous", "secret", "other"] as const
export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
})

/**
 * Valeur par défaut du nombre de signalements ouverts au-delà duquel le contexte passe « à revérifier ».
 * La valeur effective est un paramètre de la plateforme (reports.autoRecheckThreshold).
 */
export const AUTO_RECHECK_THRESHOLD = SETTINGS["reports.autoRecheckThreshold"].default

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
    if (open >= (await settingsService.get("reports.autoRecheckThreshold")) && ctx.status === "approved") {
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

  /** Liste admin : filtres par statut et motif, avec la trace de décision. */
  async listAdmin(f: { status?: "open" | "resolved" | "dismissed"; reason?: string; page: number }, pageSize = 20) {
    const where = { ...(f.status && { status: f.status }), ...(f.reason && { reason: f.reason }) }
    const [total, items] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (f.page - 1) * pageSize,
        take: pageSize,
        include: {
          context: { select: { slug: true, title: true, status: true } },
          user: { select: { id: true, name: true } },
          resolvedBy: { select: { name: true } },
        },
      }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  /**
   * Décision sur un signalement ouvert (admin). Le statut du signalement et celui du contexte restent distincts :
   * - `dismiss` : classé sans suite, contexte inchangé ;
   * - `resolve` : signalement traité, contexte inchangé (ex. corrigé entre-temps) ;
   * - `recheck` : signalement traité ET contexte publié passé « à revérifier » (journalisé).
   */
  async resolve(id: string, action: "recheck" | "resolve" | "dismiss", admin: { id: string }, note?: string) {
    const report = await prisma.report.findUnique({ where: { id }, include: { context: { select: { id: true, status: true } } } })
    if (!report) throw new BusinessError(404, "Signalement introuvable.")
    if (report.status !== "open") throw new BusinessError(409, "Ce signalement a déjà été traité.")

    const status = action === "dismiss" ? "dismissed" : "resolved"
    const resolutionNote = note?.trim() || null
    const markRecheck = action === "recheck" && report.context.status === "approved"

    await prisma.$transaction(async (tx) => {
      // Condition sur status "open" : deux admins qui traitent en même temps ne produisent qu'une décision
      const { count } = await tx.report.updateMany({
        where: { id, status: "open" },
        data: { status, resolvedAt: new Date(), resolvedById: admin.id, resolutionNote },
      })
      if (count === 0) throw new BusinessError(409, "Ce signalement a déjà été traité.")
      if (!markRecheck) return
      const moved = await tx.context.updateMany({ where: { id: report.context.id, status: "approved" }, data: { status: "to_recheck" } })
      if (moved.count === 0) return
      await tx.moderationLog.create({
        data: {
          contextId: report.context.id,
          adminId: admin.id,
          fromStatus: "approved",
          toStatus: "to_recheck",
          reason: `Signalement (${report.reason})${resolutionNote ? ` : ${resolutionNote}` : ""}`,
        },
      })
    })
    return { id, status, contextStatus: markRecheck ? "to_recheck" : report.context.status }
  },
}
