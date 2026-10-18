import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { catalogService } from "@/modules/admin/catalog.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/tags/:id { name } — renommage (index de recherche recalculé), journalisé. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/tags/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const { name } = z.object({ name: z.string() }).parse(await req.json().catch(() => ({})))
    return ok(
      await auditService.track(
        actorOf(admin),
        "tag.rename",
        { type: "tag", id, label: name },
        () => catalogService.renameTag(id, name),
        (t) => ({ from: t.previous, to: t.name })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}

/** DELETE /api/admin/tags/:id — refusé si le tag est utilisé, journalisé. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/tags/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    return ok(
      await auditService.track(actorOf(admin), "tag.delete", { type: "tag", id }, () => catalogService.deleteTag(id), (t) => ({ name: t.name }))
    )
  } catch (err) {
    return handleError(err)
  }
}
