import { requireAdmin } from "@/modules/auth/session"
import { securityService } from "@/modules/security/security.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/security/alerts/:id { status, note? } — décision sur une alerte, journalisée. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/security/alerts/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    return ok(
      await auditService.track(
        actorOf(admin),
        "security.alert",
        { type: "security_alert", id },
        () => securityService.updateStatus(id, body, admin),
        (r) => ({ from: r.from, to: r.to, context: r.contextSlug, alert: r.label, note: r.note })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
