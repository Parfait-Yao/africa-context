import type { MetadataRoute } from "next"
import { connection } from "next/server"
import { siteConfig } from "@/config/site"
import { contextService } from "@/modules/contexts/context.service"

/** Plan du site : pages publiques + fiches publiées (lu à la requête, la base n'est pas requise au build). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const base = siteConfig.url
  const { items } = await contextService.list({ pageSize: 1000, sort: "recent" })
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/contexts`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/docs`, changeFrequency: "monthly", priority: 0.5 },
    ...items.map((c) => ({ url: `${base}/contexts/${c.slug}`, lastModified: new Date(c.lastVerifiedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
  ]
}
