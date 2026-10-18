import { requireAdmin } from "@/modules/auth/session"
import { adminUsersService, userUpdateSchema } from "@/modules/admin/admin-users.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { prisma } from "@/lib/db"
import { usersService } from "@/modules/users/users.service"
import { ok, handleError } from "@/lib/api"

/** PATCH /api/admin/users/:id { role } | { suspended } — rôle ou suspension, règles vérifiées dans le service, journalisé. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const change = userUpdateSchema.parse(await req.json().catch(() => ({})))
    const target = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true, suspendedAt: true } })
    return ok(
      await auditService.track(
        actorOf(admin),
        "role" in change ? "user.role" : "user.suspension",
        { type: "user", id, label: target?.name },
        () => adminUsersService.update(admin, id, change),
        (u) => ({ role: u.role, suspended: u.suspended }),
        { before: target ? { role: target.role, suspended: Boolean(target.suspendedAt) } : null, requested: change }
      )
    )
  } catch (err) {
    return handleError(err)
  }
}

/** DELETE /api/admin/users/:id — retrait définitif d'un compte sans contexte ni historique (règles dans le service), journalisé. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const target = await prisma.user.findUnique({ where: { id }, select: { name: true } })
    const removed = await auditService.track(
      actorOf(admin),
      "user.delete",
      { type: "user", id, label: target?.name },
      () => adminUsersService.remove(admin, id),
      (r) => ({ email: r.email })
    )
    await Promise.all(removed.authors.map((a) => usersService.recomputeReputation(a)))
    return ok({ id: removed.id })
  } catch (err) {
    return handleError(err)
  }
}
