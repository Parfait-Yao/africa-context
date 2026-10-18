import { requireAdmin } from "@/modules/auth/session"
import { settingsService } from "@/modules/settings/settings.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/settings { key, value } — modifie un paramètre du registre (validation serveur), journalisé. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as { key?: unknown }
    return ok(
      await auditService.track(
        actorOf(admin),
        "settings.update",
        { type: "setting", id: typeof body.key === "string" ? body.key.slice(0, 80) : null },
        () => settingsService.update(body, admin.id),
        (r) => ({ setting: r.key, before: r.before, after: r.after })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
