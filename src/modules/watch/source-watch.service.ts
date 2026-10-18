import "server-only"
import { createHash } from "node:crypto"
import { prisma } from "@/lib/db"
import { htmlToText, safeFetchText } from "@/lib/safe-fetch"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"
import { SETTINGS, settingsService } from "@/modules/settings/settings.service"
import { redactSecrets } from "@/modules/spec/secret-scanner"

/**
 * Veille d'obsolescence (F12). Pour chaque contexte publié :
 * - première passe : l'empreinte SHA-256 du texte de la source devient la référence ;
 * - empreinte différente : le contexte passe « à revérifier » ;
 * - source inaccessible N passes de suite (paramètre watch.maxFailures, 3 par défaut) : « à revérifier ».
 * Le résultat (baseline | unchanged | changed | unreachable) et l'éventuelle erreur sont conservés sur le contexte.
 * La veille détecte un changement de la page, pas son sens : un humain doit relire le contexte.
 */
export const MAX_FAILURES = SETTINGS["watch.maxFailures"].default
export const SOURCE_CHECK_RESULTS = ["baseline", "unchanged", "changed", "unreachable"] as const
export type SourceCheckResult = (typeof SOURCE_CHECK_RESULTS)[number]

export interface WatchReport {
  checked: number
  baselined: string[]
  changed: string[]
  unreachable: { slug: string; failures: number; error: string }[]
  flagged: string[]
}

export async function checkSources(opts: { slugs?: string[] } = {}): Promise<WatchReport> {
  const contexts = await prisma.context.findMany({
    where: { status: { in: PUBLIC_STATUSES }, ...(opts.slugs && { slug: { in: opts.slugs } }) },
    select: { id: true, slug: true, status: true, sourceUrl: true, sourceHash: true, sourceCheckFailures: true },
  })
  const report: WatchReport = { checked: 0, baselined: [], changed: [], unreachable: [], flagged: [] }
  const maxFailures = await settingsService.get("watch.maxFailures")
  const ok = (result: SourceCheckResult) => ({ sourceCheckedAt: new Date(), sourceCheckFailures: 0, sourceCheckResult: result, sourceCheckError: null })

  for (const c of contexts) {
    report.checked++
    try {
      const { text } = await safeFetchText(c.sourceUrl)
      const hash = createHash("sha256").update(htmlToText(text)).digest("hex")
      if (!c.sourceHash) {
        report.baselined.push(c.slug)
        await prisma.context.update({ where: { id: c.id }, data: { sourceHash: hash, ...ok("baseline") } })
      } else if (c.sourceHash !== hash) {
        report.changed.push(c.slug)
        if (c.status === "approved") report.flagged.push(c.slug)
        await prisma.context.update({
          where: { id: c.id },
          data: { sourceHash: hash, ...ok("changed"), ...(c.status === "approved" && { status: "to_recheck" }) },
        })
      } else {
        await prisma.context.update({ where: { id: c.id }, data: ok("unchanged") })
      }
    } catch (e) {
      const failures = c.sourceCheckFailures + 1
      const flag = failures >= maxFailures && c.status === "approved"
      const error = redactSecrets(e instanceof Error ? e.message : String(e)).slice(0, 300)
      report.unreachable.push({ slug: c.slug, failures, error })
      if (flag) report.flagged.push(c.slug)
      await prisma.context.update({
        where: { id: c.id },
        data: {
          sourceCheckedAt: new Date(),
          sourceCheckFailures: failures,
          sourceCheckResult: "unreachable",
          sourceCheckError: error,
          ...(flag && { status: "to_recheck" }),
        },
      })
    }
  }
  return report
}
