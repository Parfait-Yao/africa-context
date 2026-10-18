import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"
import { COUNTRIES } from "@/config/site"
import { SERVICE_BRANDS } from "@/config/services"
import { buildSearchText } from "@/modules/contexts/search-text"
import type { ContextStatus } from "@/modules/contexts/context.types"

/**
 * Catalogue de référence. État réel du modèle :
 * - Tag : table Prisma (création, renommage, suppression si inutilisé) ;
 * - service : texte libre sur chaque contexte (+ logos dans src/config/services.ts) → renommage / fusion ;
 * - pays : codes ISO sur chaque contexte, liste de référence dans src/config/site.ts → consultation.
 */

// Mêmes contraintes que les tags de l'AfriContext Spec (2 à 30 caractères)
export const tagNameSchema = z.string().trim().toLowerCase().min(2, "2 caractères minimum.").max(30, "30 caractères maximum.")
export const serviceRenameSchema = z.object({
  from: z.string().min(1),
  to: z.string().trim().min(2, "2 caractères minimum.").max(60, "60 caractères maximum."),
})

type Tx = Prisma.TransactionClient

/** L'index de recherche contient service et tags : il est recalculé pour chaque contexte touché. */
async function reindex(tx: Tx, contextIds: string[]) {
  const rows = await tx.context.findMany({
    where: { id: { in: contextIds } },
    select: { id: true, title: true, service: true, description: true, category: true, countries: true, tags: { select: { tag: { select: { name: true } } } } },
  })
  for (const r of rows) {
    await tx.context.update({
      where: { id: r.id },
      data: { searchText: buildSearchText({ ...r, tags: r.tags.map((t) => t.tag.name) }) },
    })
  }
}

function countByStatus(rows: { status: ContextStatus; _count: { _all: number } }[]) {
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ContextStatus, number>>
  return { total: rows.reduce((n, r) => n + r._count._all, 0), published: (by.approved ?? 0) + (by.to_recheck ?? 0), pending: by.pending ?? 0 }
}

export const catalogService = {
  // --- Tags ---
  async tags(q?: string) {
    const rows = await prisma.tag.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { contexts: true } } },
    })
    return rows.map((t) => ({ id: t.id, name: t.name, uses: t._count.contexts }))
  },

  async createTag(input: unknown) {
    const name = tagNameSchema.parse(input)
    if (await prisma.tag.findUnique({ where: { name } })) throw new HttpError(409, `Le tag « ${name} » existe déjà.`)
    return prisma.tag.create({ data: { name }, select: { id: true, name: true } })
  },

  async renameTag(id: string, input: unknown) {
    const name = tagNameSchema.parse(input)
    return prisma.$transaction(async (tx) => {
      const tag = await tx.tag.findUnique({ where: { id }, select: { id: true, name: true, contexts: { select: { contextId: true } } } })
      if (!tag) throw new HttpError(404, "Tag introuvable.")
      if (tag.name === name) return { id, name, previous: tag.name }
      if (await tx.tag.findUnique({ where: { name } })) throw new HttpError(409, `Le tag « ${name} » existe déjà.`)
      await tx.tag.update({ where: { id }, data: { name } })
      await reindex(tx, tag.contexts.map((c) => c.contextId))
      return { id, name, previous: tag.name }
    })
  },

  /** Suppression uniquement si aucun contexte ne l'utilise : sinon on casserait des fiches existantes. */
  async deleteTag(id: string) {
    return prisma.$transaction(async (tx) => {
      const tag = await tx.tag.findUnique({ where: { id }, select: { name: true, _count: { select: { contexts: true } } } })
      if (!tag) throw new HttpError(404, "Tag introuvable.")
      if (tag._count.contexts > 0) {
        throw new HttpError(409, `Le tag « ${tag.name} » est utilisé par ${tag._count.contexts} contexte(s) : renommez-le plutôt que de le supprimer.`)
      }
      await tx.tag.delete({ where: { id } })
      return { id, name: tag.name }
    })
  },

  // --- Services ---
  async services() {
    const rows = await prisma.context.groupBy({ by: ["service", "status"], _count: { _all: true } })
    const names = [...new Set([...rows.map((r) => r.service), ...Object.keys(SERVICE_BRANDS)])].sort((a, b) => a.localeCompare(b, "fr"))
    return names.map((name) => ({
      name,
      hasLogo: Boolean(SERVICE_BRANDS[name]),
      ...countByStatus(rows.filter((r) => r.service === name)),
    }))
  },

  /** Renomme un service sur tous ses contextes ; si le nouveau nom existe déjà, les deux sont fusionnés. */
  async renameService(input: unknown) {
    const { from, to } = serviceRenameSchema.parse(input)
    if (from === to) throw new HttpError(400, "Le nouveau nom est identique à l'ancien.")
    return prisma.$transaction(async (tx) => {
      const ids = (await tx.context.findMany({ where: { service: from }, select: { id: true } })).map((c) => c.id)
      if (ids.length === 0) throw new HttpError(404, `Aucun contexte n'utilise le service « ${from} ».`)
      const merged = (await tx.context.count({ where: { service: to } })) > 0
      await tx.context.updateMany({ where: { id: { in: ids } }, data: { service: to } })
      await reindex(tx, ids)
      return { from, to, updated: ids.length, merged }
    })
  },

  // --- Pays ---
  async countries() {
    const rows = await prisma.context.findMany({ select: { countries: true, status: true } })
    const known = new Set(COUNTRIES.map((c) => c.code))
    const count = (code: string) => {
      const used = rows.filter((r) => r.countries.includes(code))
      return { total: used.length, published: used.filter((r) => r.status === "approved" || r.status === "to_recheck").length }
    }
    const unknown = [...new Set(rows.flatMap((r) => r.countries))].filter((c) => !known.has(c)).sort()
    return {
      reference: COUNTRIES.map((c) => ({ ...c, ...count(c.code) })),
      unknown: unknown.map((code) => ({ code, ...count(code) })),
    }
  },
}
