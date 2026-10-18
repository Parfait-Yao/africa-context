import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"
import { PAGE_SIZE } from "./admin-contexts.service"

export const adminUserFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(["user", "admin"]).optional().catch(undefined),
  state: z.enum(["active", "suspended"]).optional().catch(undefined),
  provider: z.enum(["password", "github", "google"]).optional().catch(undefined),
  sort: z.enum(["recent", "name", "reputation"]).default("recent").catch("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})
export type AdminUserFilters = z.infer<typeof adminUserFiltersSchema>

export const userUpdateSchema = z.union([
  z.object({ role: z.enum(["user", "admin"]) }).strict(),
  z.object({ suspended: z.boolean() }).strict(),
])
export type UserUpdate = z.infer<typeof userUpdateSchema>

const PROVIDER_WHERE: Record<NonNullable<AdminUserFilters["provider"]>, Prisma.UserWhereInput> = {
  password: { passwordHash: { not: null } },
  github: { githubId: { not: null } },
  google: { googleId: { not: null } },
}

const ORDER: Record<AdminUserFilters["sort"], Prisma.UserOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }],
  name: [{ name: "asc" }],
  reputation: [{ reputationScore: "desc" }, { name: "asc" }],
}

/**
 * Champs lus pour l'interface. Le hash du mot de passe et les identifiants OAuth sont lus
 * uniquement pour en déduire les modes de connexion, puis retirés avant de quitter le service.
 */
const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  reputationScore: true,
  suspendedAt: true,
  createdAt: true,
  githubUrl: true,
  githubId: true,
  googleId: true,
} satisfies Prisma.UserSelect

export const adminUsersService = {
  async list(f: AdminUserFilters, opts: { contributorsOnly?: boolean } = {}) {
    const where: Prisma.UserWhereInput = {
      ...(f.q && { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] }),
      ...(f.role && { role: f.role }),
      ...(f.state === "suspended" && { suspendedAt: { not: null } }),
      ...(f.state === "active" && { suspendedAt: null }),
      ...(f.provider && PROVIDER_WHERE[f.provider]),
      ...(opts.contributorsOnly && { contexts: { some: {} } }),
    }
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: ORDER[f.sort],
        skip: (f.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          ...publicUser,
          passwordHash: true,
          _count: { select: { contexts: true, reports: true, votes: true } },
        },
      }),
    ])
    // Le hash ne sert qu'à savoir si la connexion par mot de passe existe : il ne sort pas d'ici
    const items = rows.map(({ passwordHash, githubId, googleId, ...u }) => ({
      ...u,
      providers: [passwordHash && "Mot de passe", githubId && "GitHub", googleId && "Google"].filter(Boolean) as string[],
    }))
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
  },

  /** Contributeurs : contextes par statut, pour le classement. */
  async contributionsByStatus(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, Record<string, number>>()
    const rows = await prisma.context.groupBy({ by: ["authorId", "status"], where: { authorId: { in: userIds } }, _count: { _all: true } })
    const map = new Map<string, Record<string, number>>()
    for (const r of rows) map.set(r.authorId, { ...map.get(r.authorId), [r.status]: r._count._all })
    return map
  },

  async profile(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { ...publicUser, passwordHash: true, _count: { select: { votes: true, moderationLogs: true } } },
    })
    if (!user) return null
    const [contexts, reports] = await Promise.all([
      prisma.context.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
        select: { slug: true, title: true, status: true, service: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, reason: true, status: true, createdAt: true, context: { select: { slug: true, title: true } } },
      }),
    ])
    const { passwordHash, githubId, googleId, ...rest } = user
    return {
      user: { ...rest, providers: [passwordHash && "Mot de passe", githubId && "GitHub", googleId && "Google"].filter(Boolean) as string[] },
      contexts,
      reports,
    }
  },

  /**
   * Changement de rôle ou suspension. Règles, toutes vérifiées côté serveur :
   * - un administrateur ne modifie jamais son propre compte (ni promotion, ni rétrogradation, ni suspension) ;
   * - le dernier administrateur actif ne peut pas être rétrogradé ;
   * - un administrateur ne peut pas être suspendu : il faut d'abord lui retirer le rôle ;
   * - un compte suspendu ne peut pas être promu.
   * Transaction sérialisable : deux admins qui se rétrogradent en même temps ne peuvent pas tous deux réussir.
   */
  async update(actor: { id: string }, targetId: string, change: UserUpdate) {
    if (actor.id === targetId) throw new HttpError(403, "Vous ne pouvez pas modifier votre propre rôle ni suspendre votre propre compte.")

    return prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, suspendedAt: true } })
        if (!target) throw new HttpError(404, "Utilisateur introuvable.")

        if ("role" in change) {
          if (change.role === target.role) return { id: target.id, role: target.role, suspended: Boolean(target.suspendedAt) }
          if (change.role === "admin" && target.suspendedAt) throw new HttpError(409, "Réactivez ce compte avant de lui donner le rôle administrateur.")
          if (change.role === "user") {
            const otherAdmins = await tx.user.count({ where: { role: "admin", suspendedAt: null, id: { not: target.id } } })
            if (otherAdmins === 0) throw new HttpError(409, "Impossible de retirer le rôle au dernier administrateur actif.")
          }
          const u = await tx.user.update({ where: { id: target.id }, data: { role: change.role }, select: { id: true, role: true, suspendedAt: true } })
          return { id: u.id, role: u.role, suspended: Boolean(u.suspendedAt) }
        }

        if (change.suspended && target.role === "admin") throw new HttpError(409, "Retirez d'abord le rôle administrateur avant de suspendre ce compte.")
        const u = await tx.user.update({
          where: { id: target.id },
          data: { suspendedAt: change.suspended ? (target.suspendedAt ?? new Date()) : null },
          select: { id: true, role: true, suspendedAt: true },
        })
        return { id: u.id, role: u.role, suspended: Boolean(u.suspendedAt) }
      },
      { isolationLevel: "Serializable" }
    )
  },

  /**
   * Retrait définitif d'un compte. Ses votes, signalements et sessions sont supprimés avec lui.
   * Refusé pour son propre compte, pour un administrateur (rétrograder d'abord) et pour un compte
   * qui a des contextes ou un historique de modération : on ne casse ni le catalogue ni la traçabilité.
   * Dans ces cas, la suspension reste possible.
   */
  async remove(actor: { id: string }, targetId: string) {
    if (actor.id === targetId) throw new HttpError(403, "Vous ne pouvez pas retirer votre propre compte.")
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: targetId },
          select: { id: true, name: true, email: true, role: true, _count: { select: { contexts: true, moderationLogs: true } } },
        })
        if (!target) throw new HttpError(404, "Utilisateur introuvable.")
        if (target.role === "admin") throw new HttpError(409, "Retirez d'abord le rôle administrateur avant de retirer ce compte.")
        if (target._count.contexts > 0) {
          throw new HttpError(409, `Ce compte a ${target._count.contexts} contexte(s) : suspendez-le, ou supprimez d'abord ses contextes non publiés.`)
        }
        if (target._count.moderationLogs > 0) throw new HttpError(409, "Ce compte a un historique de modération : suspendez-le plutôt que de le retirer.")
        // Les votes recalculent la réputation des auteurs concernés après suppression
        const votedAuthors = await tx.vote.findMany({ where: { userId: target.id }, select: { context: { select: { authorId: true } } } })
        await tx.user.delete({ where: { id: target.id } })
        return { id: target.id, name: target.name, email: target.email, authors: [...new Set(votedAuthors.map((v) => v.context.authorId))] }
      },
      { isolationLevel: "Serializable" }
    )
  },
}
