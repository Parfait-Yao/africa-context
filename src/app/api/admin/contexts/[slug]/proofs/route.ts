import { requireAdmin } from "@/modules/auth/session"
import { proofsService } from "@/modules/proofs/proofs.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** POST /api/admin/contexts/:slug/proofs — ajoute une preuve avant / après (F9), journalisée. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/contexts/[slug]/proofs">) {
  try {
    const admin = await requireAdmin()
    const { slug } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const proof = await auditService.track(
      actorOf(admin),
      "context.proof.add",
      { type: "context", id: slug, label: slug },
      () => proofsService.create(slug, body),
      (p) => ({ proofId: p.id, model: p.model, sandboxResult: p.sandboxResult })
    )
    return ok({ id: proof.id }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
