import { z } from "zod"
import { requireUser } from "@/modules/auth/session"
import { draftFromUrl } from "@/modules/drafts/drafts.service"
import { aiEnabled } from "@/lib/ai"
import { rateLimit } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/** POST /api/drafts { url } — brouillon de contexte à partir d'une documentation (F11). 5 par heure et par utilisateur. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!aiEnabled()) return fail(503, "Le brouillon assisté par IA n'est pas configuré sur ce serveur.")
    if (!rateLimit(`draft:${user.id}`, 5, 60 * 60_000).ok) return fail(429, "Limite atteinte : 5 brouillons par heure.")
    const { url } = z.object({ url: z.string().url() }).parse(await req.json().catch(() => ({})))
    return ok(await draftFromUrl(url))
  } catch (err) {
    return handleError(err)
  }
}
