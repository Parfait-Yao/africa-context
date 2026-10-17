import { usersService } from "@/modules/users/users.service"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/** POST /api/auth/register { name, email, password } — création de compte email (F3). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, "register"), 5, 10 * 60_000).ok) return fail(429, "Trop de tentatives, réessayez dans quelques minutes.")
    const result = await usersService.register(await req.json().catch(() => ({})))
    if (!result.ok) return fail(409, result.error)
    return ok(result.user, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
