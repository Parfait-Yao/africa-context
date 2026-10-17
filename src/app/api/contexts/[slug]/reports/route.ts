import { requireUser } from "@/modules/auth/session"
import { reportsService } from "@/modules/reports/reports.service"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/** POST /api/contexts/:slug/reports { reason, details? } — signalement (modération). */
export async function POST(req: Request, ctx: RouteContext<"/api/contexts/[slug]/reports">) {
  try {
    const user = await requireUser()
    if (!rateLimit(clientKey(req, `report:${user.id}`), 10).ok) return fail(429, "Trop de signalements, réessayez plus tard.")
    const { slug } = await ctx.params
    return ok(await reportsService.create(slug, user.id, await req.json().catch(() => ({}))), { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
