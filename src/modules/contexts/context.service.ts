import "server-only"
import { prisma } from "@/lib/db"
import { contextRepository as repo } from "./context.repository"
import { renderContext, MINUTES_SAVED_PER_INSTALL } from "./context.formats"
import type { Context, ContextFilters, ContextStatus, ExportFormat } from "./context.types"
import { checkSections, validateSubmission } from "@/modules/spec/spec.schema"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { usersService } from "@/modules/users/users.service"

/**
 * Service métier "Contexts" : point d'entrée unique pour les pages, les routes API et les scripts.
 * Toutes les règles métier vivent ici, pas dans les composants.
 */

/** Transitions de modération autorisées. Toute autre transition est refusée (409). */
export const MODERATION_TRANSITIONS: Record<ContextStatus, ContextStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["to_recheck"],
  to_recheck: ["approved", "rejected"],
  rejected: [],
}

export { HttpError as BusinessError } from "@/lib/errors"
import { HttpError as BusinessError } from "@/lib/errors"

export const contextService = {
  list: (filters: ContextFilters) => repo.list(filters),

  getBySlug: (slug: string) => repo.findBySlug(slug),

  /** Fiche visible par son auteur ou un admin même si elle n'est pas publiée. */
  getForOwner: (slug: string) => repo.findBySlug(slug, { includeUnpublished: true }),

  listSlugs: () => repo.listSlugs(),

  facets: () => repo.facets(),

  listByAuthor: (authorId: string) => repo.listByAuthor(authorId),

  async featured(limit = 6) {
    const { items } = await repo.list({ sort: "popular", pageSize: limit })
    return items
  },

  async exportAs(slug: string, format: ExportFormat) {
    const ctx = await repo.findBySlug(slug)
    if (!ctx) return null
    return { context: ctx, body: renderContext(ctx, format) }
  },

  /** Plusieurs contextes fusionnés en un seul fichier (F13). */
  async bundle(slugs: string[], format: ExportFormat) {
    const contexts = (await Promise.all(slugs.slice(0, 10).map((s) => repo.findBySlug(s)))).filter(Boolean) as Context[]
    return { contexts, body: contexts.map((c) => renderContext(c, format)).join("\n\n") }
  },

  /** Soumission : validation Spec + scan de secrets côté serveur, puis statut `pending`. */
  async submit(input: unknown, authorId: string) {
    const { data, ...report } = validateSubmission(input)
    if (!report.valid || !data) return { ok: false as const, report }

    const existing = await repo.findRawBySlug(data.slug)
    if (existing) {
      return {
        ok: false as const,
        report: { ...report, valid: false, fieldErrors: { ...report.fieldErrors, slug: ["Ce slug est déjà utilisé."] } },
      }
    }
    const context = await repo.create(data, authorId)
    return { ok: true as const, context }
  },

  /** Correction d'un contexte par son auteur : nouvelle version, retour en `pending`. */
  async resubmit(slug: string, input: unknown, user: { id: string; role: string }) {
    const existing = await repo.findRawBySlug(slug)
    if (!existing) throw new BusinessError(404, "Contexte introuvable.")
    if (existing.authorId !== user.id && user.role !== "admin") throw new BusinessError(403, "Seul l'auteur peut modifier ce contexte.")

    const { data, ...report } = validateSubmission({ ...(input as object), slug })
    if (!report.valid || !data) return { ok: false as const, report }
    const context = await repo.update(slug, data, "Correction après relecture")
    return { ok: true as const, context: context! }
  },

  /** Modération (admin) : transitions contrôlées + journal + réputation de l'auteur. */
  async moderate(slug: string, to: ContextStatus, admin: { id: string }, reason?: string) {
    const ctx = await repo.findRawBySlug(slug)
    if (!ctx) throw new BusinessError(404, "Contexte introuvable.")
    if (!MODERATION_TRANSITIONS[ctx.status].includes(to)) {
      throw new BusinessError(409, `Transition impossible : ${ctx.status} → ${to}.`)
    }
    if (to === "rejected" && !reason?.trim()) throw new BusinessError(400, "Un motif est obligatoire pour rejeter un contexte.")
    if (to === "approved") {
      const full = await prisma.context.findUnique({ where: { id: ctx.id }, select: { contentPayload: true } })
      const { missing } = checkSections(full!.contentPayload)
      if (missing.length) throw new BusinessError(422, `Publication impossible : sections manquantes (${missing.map((m) => m.title).join(", ")}).`)
      if (scanForSecrets(full!.contentPayload).length) throw new BusinessError(422, "Publication impossible : un secret est présent dans le contenu.")
    }

    await prisma.$transaction([
      prisma.context.update({
        where: { id: ctx.id },
        data: {
          status: to,
          rejectionReason: to === "rejected" ? reason!.trim() : null,
          ...(to === "approved" && { lastVerifiedAt: new Date(), sourceHash: null, sourceCheckFailures: 0 }),
        },
      }),
      prisma.moderationLog.create({
        data: { contextId: ctx.id, adminId: admin.id, fromStatus: ctx.status, toStatus: to, reason: reason?.trim() || null },
      }),
    ])
    await usersService.recomputeReputation(ctx.authorId)
    return { slug, status: to }
  },

  async listForModeration() {
    const { items } = await repo.list({ includeStatuses: ["pending", "to_recheck"], sort: "recent", pageSize: 100 })
    return items
  },

  moderationLog: (limit = 30) =>
    prisma.moderationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { context: { select: { slug: true, title: true } }, admin: { select: { name: true } } },
    }),

  /** Compteurs d'impact globaux (F16). */
  async impact() {
    const i = await repo.impact()
    return { ...i, hoursSaved: Math.round(((i.copies + i.installs) * MINUTES_SAVED_PER_INSTALL) / 60) }
  },
}
