import { requireAdmin } from "@/modules/auth/session"
import { proofsService } from "@/modules/proofs/proofs.service"
import { ok, handleError } from "@/lib/api"

/** POST /api/admin/contexts/:slug/proofs — ajoute une preuve avant / après (F9). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/contexts/[slug]/proofs">) {
  try {
    await requireAdmin()
    const { slug } = await ctx.params
    const proof = await proofsService.create(slug, await req.json().catch(() => ({})))
    return ok({ id: proof.id }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
