import { timingSafeEqual } from "node:crypto"
import { checkSources } from "@/modules/watch/source-watch.service"
import { ok, fail, handleError } from "@/lib/api"

/** La veille parcourt toutes les sources : on laisse à la fonction le temps de finir (Vercel). */
export const maxDuration = 300

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/, "")
  return Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!))
}

/**
 * GET /api/cron/check-sources — appelée chaque nuit par Vercel Cron (vercel.json).
 * Authorization: Bearer $CRON_SECRET (ajouté automatiquement par Vercel).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return fail(401, "Jeton de tâche planifiée invalide.")
  try {
    return ok(await checkSources())
  } catch (err) {
    return handleError(err)
  }
}

/**
 * POST /api/cron/check-sources — même tâche (service cron docker-compose), avec un corps optionnel { slugs: [...] }.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return fail(401, "Jeton de tâche planifiée invalide.")
  try {
    const body = (await req.json().catch(() => ({}))) as { slugs?: string[] }
    return ok(await checkSources({ slugs: Array.isArray(body.slugs) ? body.slugs : undefined }))
  } catch (err) {
    return handleError(err)
  }
}
