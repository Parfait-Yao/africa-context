import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { securityService } from "@/modules/security/security.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import { ok, handleError } from "@/lib/api"

export const maxDuration = 120

/** POST /api/admin/security/scan { slug? } — analyse un contexte, ou tout le catalogue (admin), journalisée. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    const { slug } = z.object({ slug: z.string().max(80).optional() }).parse(await req.json().catch(() => ({})))
    const run = async () => {
      if (!slug) return securityService.scanAll()
      const ctx = await prisma.context.findUnique({ where: { slug }, select: { id: true } })
      if (!ctx) throw new HttpError(404, "Contexte introuvable.")
      const r = await securityService.scanContext(ctx.id)
      return { contexts: 1, detected: r.detected, created: r.created, autoResolved: r.autoResolved }
    }
    return ok(
      await auditService.track(
        actorOf(admin),
        "security.scan",
        { type: slug ? "context" : "catalog", id: slug ?? null, label: slug ?? "Tout le catalogue" },
        run,
        (r) => ({ ...r })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
