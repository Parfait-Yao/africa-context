import "server-only"
import { prisma } from "@/lib/db"
import { contextRepository as repo } from "./context.repository"
import { renderContext } from "./context.formats"
import type { Context, ContextFilters, ContextStatus, ExportFormat } from "./context.types"
import { checkSections, validateSubmission } from "@/modules/spec/spec.schema"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { usersService } from "@/modules/users/users.service"
import { settingsService } from "@/modules/settings/settings.service"
import { securityService } from "@/modules/security/security.service"

/**
 * Service métier "Contexts" : point d'entrée unique pour les pages, les routes API et les scripts.
 * Toutes les règles métier vivent ici, pas dans les composants.
 */

/**
 * Transitions de modération autorisées. Toute autre transition est refusée (409).
 * `approved → rejected` = dépublication (motif obligatoire) ; un contexte rejeté ne revient
 * qu'en `pending`, par une correction de son auteur.
 */
export const MODERATION_TRANSITIONS: Record<ContextStatus, ContextStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["to_recheck", "rejected"],
  to_recheck: ["approved", "rejected"],
  rejected: [],
}

export { HttpError as BusinessError } from "@/lib/errors"
import { HttpError as BusinessError } from "@/lib/errors"

/** Analyse de sécurité après une contribution acceptée : ne bloque jamais la soumission si elle échoue. */
async function scanAfterSubmit(contextId: string) {
  try {
    if (await settingsService.get("security.scanOnSubmit")) await securityService.scanContext(contextId)
  } catch (e) {
    console.error("[security] analyse après soumission impossible", e instanceof Error ? e.message : e)
  }
}

const slugOf = (input: unknown) => (typeof (input as { slug?: unknown })?.slug === "string" ? (input as { slug: string }).slug : null)

/**
 * Séparation des rôles : un administrateur contrôle, vérifie et valide les contributions,
 * il n'en publie pas et ne réécrit pas celles des autres (rôle relu en base, pas dans la session).
 */
async function assertNotAdmin(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (u?.role === "admin") {
    throw new BusinessError(403, "Les administrateurs vérifient et valident les contextes : ils n'en publient pas et ne modifient pas ceux des contributeurs.")
  }
}

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
    await assertNotAdmin(authorId)
    const { data, ...report } = validateSubmission(input)
    if (!report.valid || !data) {
      await securityService.recordValidationFailure(authorId, "submit", slugOf(input), report)
      return { ok: false as const, report }
    }

    const existing = await repo.findRawBySlug(data.slug)
    if (existing) {
      return {
        ok: false as const,
        report: { ...report, valid: false, fieldErrors: { ...report.fieldErrors, slug: ["Ce slug est déjà utilisé."] } },
      }
    }
    const context = await repo.create(data, authorId)
    await scanAfterSubmit(context.id)
    return { ok: true as const, context }
  },

  /** Correction d'un contexte par son auteur : nouvelle version, retour en `pending`. */
  async resubmit(slug: string, input: unknown, user: { id: string; role: string }) {
    const existing = await repo.findRawBySlug(slug)
    if (!existing) throw new BusinessError(404, "Contexte introuvable.")
    await assertNotAdmin(user.id)
    if (existing.authorId !== user.id) throw new BusinessError(403, "Seul l'auteur peut modifier ce contexte.")

    const { data, ...report } = validateSubmission({ ...(input as object), slug })
    if (!report.valid || !data) {
      await securityService.recordValidationFailure(user.id, "resubmit", slug, report)
      return { ok: false as const, report }
    }
    const context = await repo.update(slug, data, "Correction après relecture")
    await scanAfterSubmit(context!.id)
    return { ok: true as const, context: context! }
  },

  /** Suppression par l'auteur (ou un admin). Définitive : la réputation de l'auteur est recalculée. */
  async remove(slug: string, user: { id: string; role: string }) {
    const existing = await repo.findRawBySlug(slug)
    if (!existing) throw new BusinessError(404, "Contexte introuvable.")
    if (existing.authorId !== user.id && user.role !== "admin") throw new BusinessError(403, "Seul l'auteur peut supprimer ce contexte.")
    await repo.remove(existing.id)
    await usersService.recomputeReputation(existing.authorId)
    return { slug }
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

  /**
   * Compteurs d'impact globaux (F16). `hoursSaved` est une estimation :
   * (copies + installations) × minutes supposées par usage (paramètre impact.minutesSavedPerUse).
   */
  async impact() {
    const [i, minutesPerUse] = await Promise.all([repo.impact(), settingsService.get("impact.minutesSavedPerUse")])
    return { ...i, minutesPerUse, hoursSaved: Math.round(((i.copies + i.installs) * minutesPerUse) / 60) }
  },
}
