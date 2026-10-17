import { z } from "zod"
import { getSession, requireUser } from "@/modules/auth/session"
import { votesService } from "@/modules/votes/votes.service"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) })

/** GET /api/contexts/:slug/votes — mon vote (0 si aucun ou non connecté). */
export async function GET(_req: Request, ctx: RouteContext<"/api/contexts/[slug]/votes">) {
  const user = await getSession()
  const { slug } = await ctx.params
  return ok({ mine: user ? await votesService.mineFor(slug, user.id) : 0, authenticated: Boolean(user) })
}

/** POST /api/contexts/:slug/votes { value: 1 | -1 | 0 } — un vote par utilisateur et par contexte (F5). */
export async function POST(req: Request, ctx: RouteContext<"/api/contexts/[slug]/votes">) {
  try {
    const user = await requireUser()
    if (!rateLimit(clientKey(req, `vote:${user.id}`), 30).ok) return fail(429, "Trop de votes, réessayez dans une minute.")
    const { slug } = await ctx.params
    const { value } = voteSchema.parse(await req.json().catch(() => ({})))
    return ok(await votesService.vote(slug, user.id, value))
  } catch (err) {
    return handleError(err)
  }
}
