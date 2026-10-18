import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { catalogService } from "@/modules/admin/catalog.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** POST /api/admin/tags { name } — création d'un tag (admin), journalisée. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    const { name } = z.object({ name: z.string() }).parse(await req.json().catch(() => ({})))
    const tag = await auditService.track(
      actorOf(admin),
      "tag.create",
      { type: "tag", label: name },
      () => catalogService.createTag(name),
      (t) => ({ tagId: t.id, name: t.name })
    )
    return ok(tag, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
