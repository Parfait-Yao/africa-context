import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { eventsService, EVENT_KINDS, type EventKind } from "@/modules/events/events.service"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/** POST /api/contexts/:slug/events { kind: "view" | "copy" | "install" } (F16). */
export async function POST(req: Request, ctx: RouteContext<"/api/contexts/[slug]/events">) {
  try {
    const { slug } = await ctx.params
    if (!rateLimit(clientKey(req, `event:${slug}`), 30).ok) return fail(429, "Trop de requêtes.")
    const body = (await req.json().catch(() => ({}))) as { kind?: string }
    if (!EVENT_KINDS.includes(body.kind as EventKind)) return fail(400, "Type d'événement invalide.")

    const jar = await cookies()
    let visitorId = jar.get("ac_vid")?.value
    if (!visitorId) {
      visitorId = randomUUID()
      jar.set("ac_vid", visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" })
    }
    return ok(await eventsService.track(slug, body.kind as EventKind, { visitorId, userAgent: req.headers.get("user-agent") }))
  } catch (err) {
    return handleError(err)
  }
}
