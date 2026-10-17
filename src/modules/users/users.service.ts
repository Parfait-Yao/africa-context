import "server-only"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum.").max(200),
})

/** Réputation (F15) : +10 par contexte approuvé, +2 par vote positif reçu, -1 par vote négatif. */
export const REPUTATION = { approved: 10, upvote: 2, downvote: -1 } as const

export const usersService = {
  async register(input: unknown) {
    const data = registerSchema.parse(input)
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return { ok: false as const, error: "Un compte existe déjà avec cet email." }
    const passwordHash = await bcrypt.hash(data.password, 12)
    const user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash } })
    return { ok: true as const, user: { id: user.id, email: user.email, name: user.name } }
  },

  async verifyCredentials(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user?.passwordHash) return null
    const ok = await bcrypt.compare(password, user.passwordHash)
    return ok ? user : null
  },

  /** Connexion GitHub : crée ou relie le compte via l'email ou l'identifiant GitHub. */
  async upsertGithubUser(p: { githubId: string; email: string; name: string; githubUrl?: string; image?: string }) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ githubId: p.githubId }, { email: p.email.toLowerCase() }] } })
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { githubId: p.githubId, githubUrl: p.githubUrl ?? existing.githubUrl, image: p.image ?? existing.image },
      })
    }
    return prisma.user.create({
      data: { githubId: p.githubId, email: p.email.toLowerCase(), name: p.name, githubUrl: p.githubUrl, image: p.image },
    })
  },

  /** Connexion Google : relie au compte existant de même email (Google l'a vérifié), sinon crée le compte. */
  async upsertGoogleUser(p: { googleId: string; email: string; name: string; image?: string }) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ googleId: p.googleId }, { email: p.email.toLowerCase() }] } })
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { googleId: p.googleId, image: existing.image ?? p.image },
      })
    }
    return prisma.user.create({
      data: { googleId: p.googleId, email: p.email.toLowerCase(), name: p.name, image: p.image },
    })
  },

  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  async recomputeReputation(userId: string) {
    const [approved, up, down] = await Promise.all([
      prisma.context.count({ where: { authorId: userId, status: { in: ["approved", "to_recheck"] } } }),
      prisma.vote.count({ where: { value: 1, context: { authorId: userId } } }),
      prisma.vote.count({ where: { value: -1, context: { authorId: userId } } }),
    ])
    const score = approved * REPUTATION.approved + up * REPUTATION.upvote + down * REPUTATION.downvote
    await prisma.user.update({ where: { id: userId }, data: { reputationScore: Math.max(0, score) } })
    return score
  },

  /** Classement des contributeurs (F15). */
  leaderboard: (limit = 10) =>
    prisma.user.findMany({
      where: { reputationScore: { gt: 0 } },
      orderBy: { reputationScore: "desc" },
      take: limit,
      select: { id: true, name: true, reputationScore: true, githubUrl: true, _count: { select: { contexts: true } } },
    }),
}
