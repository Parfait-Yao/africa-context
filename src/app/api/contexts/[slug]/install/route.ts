import type { NextRequest } from "next/server"
import { contextService } from "@/modules/contexts/context.service"
import { buildInstallPlan, INSTALL_ENV_KEYS, STACKS, type InstallEnv, type Stack } from "@/modules/contexts/install-plan"
import { eventsService } from "@/modules/events/events.service"
import { rateLimit, clientKey } from "@/lib/rate-limit"
import { ok, fail, handleError } from "@/lib/api"

/**
 * GET /api/contexts/:slug/install?env=cursor|claude|windsurf|copilot|agents&stack=next|express|…
 * Plan d'installation complet utilisé par `npx africontext add` : règles de l'agent adaptées au projet,
 * variables d'environnement à déclarer, protection du .env. Contextes publiés uniquement.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/contexts/[slug]/install">) {
  try {
    if (!rateLimit(clientKey(req, "install"), 60).ok) return fail(429, "Trop de requêtes, réessayez dans une minute.")
    const { slug } = await ctx.params
    const sp = req.nextUrl.searchParams
    const env = sp.get("env") ?? "agents"
    const stack = sp.get("stack") ?? "unknown"
    if (!INSTALL_ENV_KEYS.includes(env as InstallEnv)) return fail(400, `Environnement inconnu : choisissez ${INSTALL_ENV_KEYS.join(", ")}.`)

    const context = await contextService.getBySlug(slug)
    if (!context) return fail(404, "Contexte introuvable ou non publié.")

    if (req.headers.get("user-agent")?.startsWith("africontext-cli")) await eventsService.track(slug, "install")
    const plan = buildInstallPlan(context, env as InstallEnv, STACKS.includes(stack as Stack) ? (stack as Stack) : "unknown")
    return ok(plan, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return handleError(err)
  }
}
