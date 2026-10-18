import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { contextService } from "@/modules/contexts/context.service"
import { adminContextsService } from "@/modules/admin/admin-contexts.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

const moderationSchema = z.object({
  status: z.enum(["approved", "rejected", "to_recheck"]),
  reason: z.string().trim().max(1000).optional(),
})

/** PATCH /api/admin/contexts/:slug { status, reason? } — modération (F6), admin uniquement, journalisée. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/contexts/[slug]">) {
  try {
    const admin = await requireAdmin()
    const { slug } = await ctx.params
    const { status, reason } = moderationSchema.parse(await req.json().catch(() => ({})))
    return ok(
      await auditService.track(
        actorOf(admin),
        "context.moderate",
        { type: "context", id: slug, label: slug },
        () => contextService.moderate(slug, status, admin, reason),
        undefined,
        { to: status, reason }
      )
    )
  } catch (err) {
    return handleError(err)
  }
}

/** DELETE /api/admin/contexts/:slug — suppression d'un contexte non publié (admin uniquement), journalisée. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/contexts/[slug]">) {
  try {
    const admin = await requireAdmin()
    const { slug } = await ctx.params
    return ok(
      await auditService.track(actorOf(admin), "context.delete", { type: "context", id: slug, label: slug }, () => adminContextsService.remove(slug, admin))
    )
  } catch (err) {
    return handleError(err)
  }
}
