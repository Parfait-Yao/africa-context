import { requireAdmin } from "@/modules/auth/session"
import { catalogService } from "@/modules/admin/catalog.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/services { from, to } — renomme (ou fusionne) un service sur tous ses contextes, journalisé. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as { from?: unknown; to?: unknown }
    return ok(
      await auditService.track(
        actorOf(admin),
        "service.rename",
        { type: "service", label: typeof body.from === "string" ? body.from : null },
        () => catalogService.renameService(body),
        (r) => ({ from: r.from, to: r.to, updated: r.updated, merged: r.merged })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
