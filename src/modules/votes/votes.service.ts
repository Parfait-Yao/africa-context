import "server-only"
import { prisma } from "@/lib/db"
import { usersService } from "@/modules/users/users.service"
import { HttpError as BusinessError } from "@/lib/errors"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"

/**
 * Votes (F5). Un vote par utilisateur et par contexte : contrainte unique (userId, contextId).
 * value 1 ou -1 ; 0 retire le vote.
 */
export const votesService = {
  async vote(slug: string, userId: string, value: -1 | 0 | 1) {
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true, authorId: true, status: true } })
    if (!ctx || !PUBLIC_STATUSES.includes(ctx.status)) throw new BusinessError(404, "Contexte introuvable.")
    if (ctx.authorId === userId) throw new BusinessError(403, "Vous ne pouvez pas voter pour votre propre contexte.")

    if (value === 0) await prisma.vote.deleteMany({ where: { userId, contextId: ctx.id } })
    else
      await prisma.vote.upsert({
        where: { userId_contextId: { userId, contextId: ctx.id } },
        create: { userId, contextId: ctx.id, value },
        update: { value },
      })

    await usersService.recomputeReputation(ctx.authorId)
    return this.summary(ctx.id, userId)
  },

  async summary(contextId: string, userId?: string) {
    const [up, down, mine] = await Promise.all([
      prisma.vote.count({ where: { contextId, value: 1 } }),
      prisma.vote.count({ where: { contextId, value: -1 } }),
      userId ? prisma.vote.findUnique({ where: { userId_contextId: { userId, contextId } } }) : null,
    ])
    return { up, down, mine: (mine?.value ?? 0) as -1 | 0 | 1 }
  },

  async mineFor(slug: string, userId: string) {
    const v = await prisma.vote.findFirst({ where: { userId, context: { slug } }, select: { value: true } })
    return (v?.value ?? 0) as -1 | 0 | 1
  },
}
