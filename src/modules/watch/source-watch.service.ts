import "server-only"
import { createHash } from "node:crypto"
import { prisma } from "@/lib/db"
import { htmlToText, safeFetchText } from "@/lib/safe-fetch"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"

/**
 * Veille d'obsolescence (F12). Pour chaque contexte publié :
 * - première passe : l'empreinte SHA-256 du texte de la source devient la référence ;
 * - empreinte différente : le contexte passe « à revérifier » ;
 * - source inaccessible 3 passes de suite : « à revérifier ».
 */
export const MAX_FAILURES = 3

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

  for (const c of contexts) {
    report.checked++
    try {
      const { text } = await safeFetchText(c.sourceUrl)
      const hash = createHash("sha256").update(htmlToText(text)).digest("hex")
      if (!c.sourceHash) {
        report.baselined.push(c.slug)
        await prisma.context.update({ where: { id: c.id }, data: { sourceHash: hash, sourceCheckedAt: new Date(), sourceCheckFailures: 0 } })
      } else if (c.sourceHash !== hash) {
        report.changed.push(c.slug)
        if (c.status === "approved") report.flagged.push(c.slug)
        await prisma.context.update({
          where: { id: c.id },
          data: { sourceHash: hash, sourceCheckedAt: new Date(), sourceCheckFailures: 0, ...(c.status === "approved" && { status: "to_recheck" }) },
        })
      } else {
        await prisma.context.update({ where: { id: c.id }, data: { sourceCheckedAt: new Date(), sourceCheckFailures: 0 } })
      }
    } catch (e) {
      const failures = c.sourceCheckFailures + 1
      const flag = failures >= MAX_FAILURES && c.status === "approved"
      report.unreachable.push({ slug: c.slug, failures, error: e instanceof Error ? e.message : String(e) })
      if (flag) report.flagged.push(c.slug)
      await prisma.context.update({
        where: { id: c.id },
        data: { sourceCheckedAt: new Date(), sourceCheckFailures: failures, ...(flag && { status: "to_recheck" }) },
      })
    }
  }
  return report
}
