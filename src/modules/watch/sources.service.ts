import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"
import type { ContextStatus } from "@/modules/contexts/context.types"
import type { SourceCheckResult } from "./source-watch.service"

/**
 * Vue d'administration de la veille documentaire : une ligne par URL source,
 * avec les contextes qui l'utilisent et le résultat réel du dernier contrôle.
 */

/** Au-delà de ce délai sans contrôle, la veille (tâche planifiée quotidienne) est probablement arrêtée. */
export const STALE_AFTER_HOURS = 48

// Liste écrite en dur (pas de spread d'un import) : évalué au chargement du module, un import
// circulaire pourrait encore être indéfini. Les résultats de la veille sont vérifiés par le type ci-dessous.
export const SOURCE_STATES = ["never", "stale", "baseline", "unchanged", "changed", "unreachable", "unwatched"] as const
export type SourceState = (typeof SOURCE_STATES)[number]
// Garde-fou de compilation : chaque résultat de la veille est un état connu
const _results: readonly SourceState[] = [] as SourceCheckResult[]
void _results

export const sourceFiltersSchema = z.object({
  state: z.enum(SOURCE_STATES).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
})

export interface SourceRow {
  url: string
  host: string
  state: SourceState
  lastCheckedAt: Date | null
  failures: number
  error: string | null
  contexts: { slug: string; title: string; status: ContextStatus; result: string | null }[]
}

const host = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export const sourcesService = {
  async list(f: z.infer<typeof sourceFiltersSchema>) {
    const contexts = await prisma.context.findMany({
      select: {
        slug: true,
        title: true,
        status: true,
        sourceUrl: true,
        sourceCheckedAt: true,
        sourceCheckFailures: true,
        sourceCheckResult: true,
        sourceCheckError: true,
      },
      orderBy: { sourceUrl: "asc" },
    })
    const staleBefore = Date.now() - STALE_AFTER_HOURS * 3600 * 1000
    const byUrl = new Map<string, typeof contexts>()
    for (const c of contexts) byUrl.set(c.sourceUrl, [...(byUrl.get(c.sourceUrl) ?? []), c])

    const rows: SourceRow[] = [...byUrl.entries()].map(([url, list]) => {
      const watched = list.filter((c) => PUBLIC_STATUSES.includes(c.status))
      // Le contrôle le plus récent parmi les contextes surveillés fait foi pour l'URL
      const latest = watched.filter((c) => c.sourceCheckedAt).sort((a, b) => b.sourceCheckedAt!.getTime() - a.sourceCheckedAt!.getTime())[0]
      const failures = Math.max(0, ...watched.map((c) => c.sourceCheckFailures))
      let state: SourceState
      if (watched.length === 0) state = "unwatched"
      else if (!latest) state = "never"
      else if (latest.sourceCheckedAt!.getTime() < staleBefore) state = "stale"
      else if (failures > 0) state = "unreachable"
      else if (watched.some((c) => c.sourceCheckResult === "changed")) state = "changed"
      else state = (latest.sourceCheckResult as SourceState | null) ?? "unchanged"
      return {
        url,
        host: host(url),
        state,
        lastCheckedAt: latest?.sourceCheckedAt ?? null,
        failures,
        error: watched.find((c) => c.sourceCheckError)?.sourceCheckError ?? null,
        contexts: list.map((c) => ({ slug: c.slug, title: c.title, status: c.status, result: c.sourceCheckResult })),
      }
    })

    const counts = Object.fromEntries(SOURCE_STATES.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<SourceState, number>
    const q = f.q?.toLowerCase()
    const filtered = rows.filter((r) => (!f.state || r.state === f.state) && (!q || r.url.toLowerCase().includes(q) || r.contexts.some((c) => c.slug.includes(q))))
    // Ce qui demande une action d'abord
    const order: SourceState[] = ["unreachable", "changed", "stale", "never", "baseline", "unchanged", "unwatched"]
    filtered.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.url.localeCompare(b.url))

    // À faire : contextes passés « à revérifier » suite à la veille
    const toReview = contexts.filter((c) => c.status === "to_recheck" && (c.sourceCheckResult === "changed" || c.sourceCheckResult === "unreachable"))
    return { rows: filtered, counts, total: rows.length, toReview }
  },

  /** Contextes publiés utilisant une URL (pour une vérification manuelle). */
  async slugsFor(url: string) {
    const rows = await prisma.context.findMany({ where: { sourceUrl: url, status: { in: PUBLIC_STATUSES } }, select: { slug: true } })
    return rows.map((r) => r.slug)
  },
}
