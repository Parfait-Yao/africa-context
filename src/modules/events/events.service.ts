import "server-only"
import { prisma } from "@/lib/db"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"

/**
 * Événements d'usage (F16) : consultation, copie, installation — trois types distincts
 * pour que les compteurs ne soient pas trompeurs. Une vue = un visiteur par jour.
 */
export const EVENT_KINDS = ["view", "copy", "install"] as const
export type EventKind = (typeof EVENT_KINDS)[number]

const BOT_UA = /bot|crawler|spider|preview|headless|curl|wget|python-requests/i

export const eventsService = {
  async track(slug: string, kind: EventKind, opts: { visitorId?: string; userAgent?: string | null } = {}) {
    if (kind === "view" && opts.userAgent && BOT_UA.test(opts.userAgent)) return { recorded: false }
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true, status: true } })
    if (!ctx || !PUBLIC_STATUSES.includes(ctx.status)) return { recorded: false }

    if (kind === "view" && opts.visitorId) {
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      const seen = await prisma.event.findFirst({
        where: { contextId: ctx.id, kind: "view", visitorId: opts.visitorId, createdAt: { gte: startOfDay } },
        select: { id: true },
      })
      if (seen) return { recorded: false }
    }
    await prisma.event.create({ data: { contextId: ctx.id, kind, visitorId: opts.visitorId ?? null } })
    return { recorded: true }
  },
}
