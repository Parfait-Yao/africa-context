import { z } from "zod"
import { requireAdmin } from "@/modules/auth/session"
import { checkSources } from "@/modules/watch/source-watch.service"
import { sourcesService } from "@/modules/watch/sources.service"
import { actorOf, auditService } from "@/modules/audit/audit.service"
import { HttpError } from "@/lib/errors"
import { ok, handleError } from "@/lib/api"

export const maxDuration = 60

/**
 * POST /api/admin/sources/check { url } — relance la veille sur une URL source (contextes publiés qui l'utilisent).
 * Même mécanisme que la tâche planifiée : récupération protégée (SSRF), comparaison d'empreinte. Journalisé.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    const { url } = z.object({ url: z.string().url().max(2000) }).parse(await req.json().catch(() => ({})))
    const run = async () => {
      const slugs = await sourcesService.slugsFor(url)
      if (slugs.length === 0) throw new HttpError(404, "Aucun contexte publié n'utilise cette source : elle n'est pas surveillée.")
      return checkSources({ slugs })
    }
    return ok(
      await auditService.track(
        actorOf(admin),
        "source.check",
        { type: "source", id: url.slice(0, 300), label: url.slice(0, 200) },
        run,
        (r) => ({ checked: r.checked, changed: r.changed, unreachable: r.unreachable.map((u) => u.slug), flagged: r.flagged })
      )
    )
  } catch (err) {
    return handleError(err)
  }
}
