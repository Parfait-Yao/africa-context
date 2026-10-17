import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { contextService } from "@/modules/contexts/context.service"
import { ok, handleError } from "@/lib/api"

const moderationSchema = z.object({
  status: z.enum(["approved", "rejected", "to_recheck"]),
  reason: z.string().trim().max(1000).optional(),
})

/** PATCH /api/admin/contexts/:slug { status, reason? } — modération (F6), admin uniquement. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/contexts/[slug]">) {
  try {
    const admin = await requireAdmin()
    const { slug } = await ctx.params
    const { status, reason } = moderationSchema.parse(await req.json().catch(() => ({})))
    return ok(await contextService.moderate(slug, status, admin, reason))
  } catch (err) {
    return handleError(err)
  }
}
