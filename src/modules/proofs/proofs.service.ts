import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError as BusinessError } from "@/lib/errors"
import { scanForSecrets } from "@/modules/spec/secret-scanner"

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
    const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true } })
    if (!ctx) throw new BusinessError(404, "Contexte introuvable.")
    return prisma.proof.create({ data: { ...data, contextId: ctx.id } })
  },

  async setSandboxResult(proofId: string, result: "passed" | "failed") {
    return prisma.proof.update({ where: { id: proofId }, data: { sandboxResult: result } })
  },
}
