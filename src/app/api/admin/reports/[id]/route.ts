import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { reportsService } from "@/modules/reports/reports.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

const decisionSchema = z.object({
  action: z.enum(["recheck", "resolve", "dismiss"]),
  note: z.string().trim().max(1000).optional(),
})

/** PATCH /api/admin/reports/:id { action: "recheck" | "resolve" | "dismiss", note? } — décision tracée (admin). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const { action, note } = decisionSchema.parse(await req.json().catch(() => ({})))
    return ok(
      await auditService.track(
        actorOf(admin),
        "report.decide",
        { type: "report", id },
        () => reportsService.resolve(id, action, admin, note),
        (r) => ({ status: r.status, contextStatus: r.contextStatus }),
        { action, note }
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
