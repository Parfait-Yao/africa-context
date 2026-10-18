import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError as BusinessError } from "@/lib/errors"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import type { Prisma } from "@/generated/prisma/client"

/** Preuves avant / après (F9). */
export const proofSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  outputWithoutContext: z.string().min(10).max(20000),
  outputWithContext: z.string().min(10).max(20000),
  model: z.string().trim().min(2).max(120),
  sandboxResult: z.enum(["passed", "failed"]).optional(),
})

export const proofsService = {
  async create(slug: string, input: unknown) {
    const data = proofSchema.parse(input)
    const secrets = scanForSecrets(Object.values(data).join("\n"))
    if (secrets.length) throw new BusinessError(422, "La preuve contient un secret.", secrets)
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true, apiVersion: true } })
    if (!ctx) throw new BusinessError(404, "Contexte introuvable.")
    // La version d'API est figée au moment de la preuve : le contexte peut évoluer ensuite
    return prisma.proof.create({ data: { ...data, contextId: ctx.id, apiVersion: ctx.apiVersion } })
  },

  /**
   * Preuves et tests enregistrés, pour l'administration. Rien n'est recalculé ni simulé :
   * seules les données réellement capturées (script proof:capture ou ajout manuel) sont affichées.
   */
  async listAdmin(f: { result?: "passed" | "failed" | "none"; q?: string; page: number }, pageSize = 20) {
    const where: Prisma.ProofWhereInput = {
      ...(f.result === "none" ? { sandboxResult: null } : f.result && { sandboxResult: f.result }),
      ...(f.q && { context: { OR: [{ slug: { contains: f.q.toLowerCase() } }, { service: { contains: f.q, mode: "insensitive" } }] } }),
    }
    const [total, items] = await Promise.all([
      prisma.proof.count({ where }),
      prisma.proof.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (f.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          model: true,
          prompt: true,
          sandboxResult: true,
          sandboxReport: true,
          apiVersion: true,
          createdAt: true,
          context: { select: { slug: true, title: true, service: true, apiVersion: true, sourceUrl: true, lastVerifiedAt: true, status: true } },
        },
      }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  /** Couverture : contextes publiés avec / sans preuve, résultats sandbox. */
  async coverage() {
    const published = { status: { in: ["approved", "to_recheck"] as ("approved" | "to_recheck")[] } }
    const [proofs, byResult, withProof, publishedCount, untested] = await Promise.all([
      prisma.proof.count(),
      prisma.proof.groupBy({ by: ["sandboxResult"], _count: { _all: true } }),
      prisma.context.count({ where: { ...published, proofs: { some: {} } } }),
      prisma.context.count({ where: published }),
      prisma.context.findMany({
        where: { ...published, proofs: { none: {} } },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { slug: true, title: true, service: true, apiVersion: true, lastVerifiedAt: true },
      }),
    ])
    const r = (v: string | null) => byResult.find((b) => b.sandboxResult === v)?._count._all ?? 0
    return { proofs, passed: r("passed"), failed: r("failed"), notRun: r(null), withProof, publishedCount, untested }
  },

  /** Exécutions sandbox enregistrées (preuves avec un résultat). */
  sandboxRuns: (take = 30) =>
    prisma.proof.findMany({
      where: { sandboxResult: { not: null } },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, sandboxResult: true, sandboxReport: true, model: true, createdAt: true, context: { select: { slug: true, title: true, service: true } } },
    }),

  async setSandboxResult(proofId: string, result: "passed" | "failed") {
    return prisma.proof.update({ where: { id: proofId }, data: { sandboxResult: result } })
  },
}
