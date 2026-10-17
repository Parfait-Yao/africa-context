import { contextService } from "@/modules/contexts/context.service"
import { getSession, requireUser } from "@/modules/auth/session"
import { ok, fail, handleError } from "@/lib/api"

/** GET /api/contexts/:slug — fiche publique (F2). L'auteur et les admins voient aussi les non publiées. */
export async function GET(_req: Request, ctx: RouteContext<"/api/contexts/[slug]">) {
  try {
    const { slug } = await ctx.params
    let context = await contextService.getBySlug(slug)
    if (!context) {
      const user = await getSession()
      const own = user ? await contextService.getForOwner(slug) : null
      if (own && (own.author.id === user!.id || user!.role === "admin")) context = own
    }
    if (!context) return fail(404, "Contexte introuvable ou non publié.")
    return ok(context)
  } catch (err) {
    return handleError(err)
  }
}

/** PUT /api/contexts/:slug — correction par l'auteur, retour en attente de validation. */
export async function PUT(req: Request, ctx: RouteContext<"/api/contexts/[slug]">) {
  try {
    const user = await requireUser()
    const { slug } = await ctx.params
    const result = await contextService.resubmit(slug, await req.json().catch(() => ({})), user)
    if (!result.ok) return fail(422, "Le contexte ne respecte pas l'AfriContext Spec.", result.report)
    return ok({ slug: result.context.slug, status: result.context.status })
  } catch (err) {
    return handleError(err)
  }
}
