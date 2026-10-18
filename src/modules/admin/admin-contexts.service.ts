import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"
import { contextService } from "@/modules/contexts/context.service"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"
import { CONTEXT_STATUSES, CONTEXT_TYPES } from "@/modules/contexts/context.types"
import { normalize } from "@/modules/contexts/search-text"
import { runContextChecks } from "@/modules/spec/context-checks"

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

/** Filtres de la liste admin, lus depuis l'URL : toute valeur invalide est ignorée plutôt que de faire échouer la page. */
export const adminContextFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  service: z.string().trim().max(60).optional().catch(undefined),
  country: z.string().length(2).optional().catch(undefined),
  status: z.enum(CONTEXT_STATUSES).optional().catch(undefined),
  type: z.enum(CONTEXT_TYPES).optional().catch(undefined),
  from: date,
  to: date,
  sort: z.enum(["recent", "oldest", "updated", "title"]).default("recent").catch("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})

export type AdminContextFilters = z.infer<typeof adminContextFiltersSchema>

export const PAGE_SIZE = 20

/** Les `searchParams` de Next arrivent en string | string[] : on ne garde que les valeurs simples non vides. */
export function pickParams(sp: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string" && v !== "")) as Record<string, string>
}

function buildWhere(f: AdminContextFilters): Prisma.ContextWhereInput {
  const terms = f.q ? normalize(f.q).split(" ").filter(Boolean) : []
  return {
    ...(f.status && { status: f.status }),
    ...(f.type && { type: f.type }),
    ...(f.service && { service: f.service }),
    ...(f.country && { countries: { has: f.country } }),
    ...((f.from || f.to) && {
      createdAt: {
        ...(f.from && { gte: new Date(`${f.from}T00:00:00.000Z`) }),
        ...(f.to && { lte: new Date(`${f.to}T23:59:59.999Z`) }),
      },
    }),
    ...(terms.length > 0 && { AND: terms.map((t) => ({ OR: [{ searchText: { contains: t } }, { slug: { contains: t } }] })) }),
  }
}

const ORDER: Record<AdminContextFilters["sort"], Prisma.ContextOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  updated: { updatedAt: "desc" },
  title: { title: "asc" },
}

export const adminContextsService = {
  async list(f: AdminContextFilters) {
    const where = buildWhere(f)
    const [total, items] = await Promise.all([
      prisma.context.count({ where }),
      prisma.context.findMany({
        where,
        orderBy: ORDER[f.sort],
        skip: (f.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          service: true,
          countries: true,
          apiVersion: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true } },
          _count: { select: { versions: true, reports: { where: { status: "open" } } } },
        },
      }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
  },

  /** Valeurs proposées dans les filtres (tous statuts confondus). */
  async services() {
    const rows = await prisma.context.groupBy({ by: ["service"], _count: { _all: true }, orderBy: { service: "asc" } })
    return rows.map((r) => r.service)
  },

  /** Fiche complète pour la relecture : contexte, auteur, validation, versions, signalements, historique. */
  async detail(slug: string) {
    const context = await contextService.getForOwner(slug)
    if (!context) return null
    const [extra, versions, reports, history] = await Promise.all([
      prisma.context.findUnique({
        where: { id: context.id },
        select: {
          updatedAt: true,
          sourceCheckedAt: true,
          sourceCheckFailures: true,
          author: {
            select: {
              id: true,
              email: true,
              role: true,
              reputationScore: true,
              suspendedAt: true,
              createdAt: true,
              githubUrl: true,
              _count: { select: { contexts: true } },
            },
          },
        },
      }),
      prisma.contextVersion.findMany({ where: { contextId: context.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.report.findMany({
        where: { contextId: context.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } }, resolvedBy: { select: { name: true } } },
      }),
      prisma.moderationLog.findMany({
        where: { contextId: context.id },
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true } } },
      }),
    ])
    const approvedByAuthor = await prisma.context.count({ where: { authorId: context.author.id, status: { in: PUBLIC_STATUSES } } })
    const checks = runContextChecks({
      ...context,
      sourceCheckedAt: extra?.sourceCheckedAt?.toISOString() ?? null,
      sourceCheckFailures: extra?.sourceCheckFailures ?? 0,
    })
    return { context, extra: extra!, approvedByAuthor, versions, reports, history, checks }
  },

  /**
   * Suppression par un admin : réservée aux contextes non publiés (en attente ou rejetés).
   * Un contexte publié doit d'abord être dépublié, ce qui laisse une trace dans le journal.
   */
  async remove(slug: string, admin: { id: string; role: "admin" }) {
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { status: true } })
    if (!ctx) throw new HttpError(404, "Contexte introuvable.")
    if (PUBLIC_STATUSES.includes(ctx.status)) {
      throw new HttpError(409, "Ce contexte est publié : dépubliez-le avant de le supprimer.")
    }
    return contextService.remove(slug, admin)
  },

  /** Historique des versions, tous contextes confondus. */
  async recentVersions(page: number) {
    const [total, items] = await Promise.all([
      prisma.contextVersion.count(),
      prisma.contextVersion.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, note: true, createdAt: true, context: { select: { slug: true, title: true, status: true } } },
      }),
    ])
    return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
  },
}
