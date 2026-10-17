import type { NextRequest } from "next/server"
import { contextService } from "@/modules/contexts/context.service"
import { EXPORT_FORMATS, type ExportFormat } from "@/modules/contexts/context.types"

/** GET /api/contexts/bundle?slugs=a,b,c&format=claude — panier de contextes fusionnés (F13). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const slugs = (sp.get("slugs") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (slugs.length === 0) return new Response("Paramètre slugs attendu (ex. ?slugs=wave-checkout-api,africastalking-sms).\n", { status: 400 })
  const requested = sp.get("format") ?? "agents"
  const format: ExportFormat = EXPORT_FORMATS.includes(requested as ExportFormat) ? (requested as ExportFormat) : "agents"
  const { contexts, body } = await contextService.bundle(slugs, format)
  if (contexts.length === 0) return new Response("Aucun contexte publié parmi ces slugs.\n", { status: 404 })
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "X-AfriContext-Included": contexts.map((c) => c.slug).join(",") },
  })
}
