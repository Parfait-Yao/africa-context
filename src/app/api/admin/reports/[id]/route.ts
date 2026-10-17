import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { reportsService } from "@/modules/reports/reports.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/reports/:id { action: "recheck" | "dismiss" } */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const { action } = z.object({ action: z.enum(["recheck", "dismiss"]) }).parse(await req.json().catch(() => ({})))
    return ok(await reportsService.resolve(id, action))
  } catch (err) {
    return handleError(err)
  }
}
