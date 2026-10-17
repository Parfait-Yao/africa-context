import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { contextService } from "@/modules/contexts/context.service"
import { EXPORT_FORMATS, type ExportFormat } from "@/modules/contexts/context.types"
import { targetFileName } from "@/modules/contexts/context.formats"
import { eventsService } from "@/modules/events/events.service"

/**
 * GET /api/contexts/:slug/raw?format=raw|cursorrules|claude|agents (F7) — utilisé par la CLI.
 * En-têtes X-AfriContext-* : fichier cible, date de vérification, statut.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/contexts/[slug]/raw">) {
  const { slug } = await ctx.params
  const requested = req.nextUrl.searchParams.get("format") ?? "raw"
  const format: ExportFormat = EXPORT_FORMATS.includes(requested as ExportFormat) ? (requested as ExportFormat) : "raw"

  const result = await contextService.exportAs(slug, format)
  if (!result) return new Response("Contexte introuvable ou non publié.\n", { status: 404 })

  let body = result.body
  if (result.context.status === "to_recheck") {
    const warning = `> ⚠️ Ce contexte est marqué « à revérifier » : contrôlez la source officielle (${result.context.sourceUrl}).\n\n`
    body = format === "cursorrules" ? body.replace(/\n# /, `\n${warning}# `) : warning + body
  }

  if (req.headers.get("user-agent")?.startsWith("africontext-cli")) await eventsService.track(slug, "install")

  const etag = `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`
  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "X-AfriContext-Target": targetFileName(format, slug),
    "X-AfriContext-Verified-At": result.context.lastVerifiedAt,
    "X-AfriContext-Status": result.context.status,
    ETag: etag,
    "Cache-Control": "public, max-age=60",
  }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers })
  return new Response(body, { headers })
}
