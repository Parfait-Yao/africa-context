import type { NextRequest } from "next/server"
import { contextService } from "@/modules/contexts/context.service"
import { CONTEXT_TYPES, type ContextType } from "@/modules/contexts/context.types"
import { requireUser } from "@/modules/auth/session"
import { parseSpecMarkdown } from "@/modules/spec/spec.parser"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/** GET /api/contexts?q=&country=&type=&category=&tag=&sort=&page= — catalogue public (F1). */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const type = sp.get("type")
    const sort = sp.get("sort")
    const result = await contextService.list({
      q: sp.get("q") ?? undefined,
      country: sp.get("country") ?? undefined,
      category: sp.get("category") ?? undefined,
      tag: sp.get("tag") ?? undefined,
      type: CONTEXT_TYPES.includes(type as ContextType) ? (type as ContextType) : undefined,
      sort: sort === "recent" || sort === "verified" ? sort : "popular",
      page: Math.max(1, Number(sp.get("page") ?? 1) || 1),
      pageSize: Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 12) || 12)),
    })
    return ok({ ...result, items: result.items.map(({ content: _c, proofs: _p, rejectionReason: _r, ...rest }) => rest) })
  } catch (err) {
    return handleError(err)
  }
}

/**
 * POST /api/contexts — soumission (F4 + F6).
 * Corps JSON conforme à la Spec, ou { markdown: "---\nfront matter\n---\ncorps" } pour importer un fichier .md.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!rateLimit(clientKey(req, `submit:${user.id}`), 10).ok) return fail(429, "Trop de soumissions, réessayez dans une minute.")

    const body = await req.json().catch(() => null)
    if (!body) return fail(400, "Corps JSON attendu.")
    const input = typeof body.markdown === "string" ? parseSpecMarkdown(body.markdown) : body

    const result = await contextService.submit(input, user.id)
    if (!result.ok) {
      return fail(
        422,
        result.report.secrets.length > 0
          ? "Soumission bloquée : un secret a été détecté. Remplacez-le par le nom d'une variable d'environnement."
          : "Le contexte ne respecte pas l'AfriContext Spec.",
        result.report
      )
    }
    return ok({ slug: result.context.slug, status: result.context.status }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
