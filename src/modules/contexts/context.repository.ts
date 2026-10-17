import "server-only"
import { prisma } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import type { Context, ContextFilters, ContextStatus, Paginated } from "./context.types"
import type { ContextSubmission } from "@/modules/spec/spec.schema"
import { buildSearchText, normalize } from "./search-text"

/**
 * Accès aux données des contextes (PostgreSQL via Prisma).
 * Les pages et routes API ne l'appellent jamais directement : elles passent par contextService.
 */
export const PUBLIC_STATUSES: ContextStatus[] = ["approved", "to_recheck"]

const include = {
  author: true,
  tags: { include: { tag: true } },
  proofs: { orderBy: { createdAt: "desc" } },
  versions: { orderBy: { createdAt: "desc" }, select: { id: true, note: true, createdAt: true } },
} satisfies Prisma.ContextInclude

type ContextRow = Prisma.ContextGetPayload<{ include: typeof include }>

type Stats = Context["stats"]
const emptyStats = (): Stats => ({ views: 0, copies: 0, installs: 0, upvotes: 0, downvotes: 0 })

/** Compteurs pour une liste de contextes en 2 requêtes groupées (pas de N+1). */
async function statsFor(ids: string[]) {
  const map = new Map<string, Stats>(ids.map((id) => [id, emptyStats()]))
  if (ids.length === 0) return map
  const [events, votes] = await Promise.all([
    prisma.event.groupBy({ by: ["contextId", "kind"], where: { contextId: { in: ids } }, _count: { _all: true } }),
    prisma.vote.groupBy({ by: ["contextId", "value"], where: { contextId: { in: ids } }, _count: { _all: true } }),
  ])
  for (const e of events) {
    const s = map.get(e.contextId)!
    if (e.kind === "view") s.views = e._count._all
    if (e.kind === "copy") s.copies = e._count._all
    if (e.kind === "install") s.installs = e._count._all
  }
  for (const v of votes) {
    const s = map.get(v.contextId)!
    if (v.value === 1) s.upvotes = v._count._all
    if (v.value === -1) s.downvotes = v._count._all
  }
  return map
}

function toDomain(row: ContextRow, stats: Stats): Context {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    service: row.service,
    category: row.category,
    countries: row.countries,
    apiVersion: row.apiVersion,
    sourceUrl: row.sourceUrl,
    testedWith: row.testedWith as Context["testedWith"],
    tags: row.tags.map((t) => t.tag.name).sort(),
    status: row.status,
    rejectionReason: row.rejectionReason ?? undefined,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    content: row.contentPayload,
    author: {
      id: row.author.id,
      name: row.author.name,
      githubUrl: row.author.githubUrl ?? undefined,
      reputationScore: row.author.reputationScore,
    },
    stats,
    proofs: row.proofs.map((p) => ({
      id: p.id,
      prompt: p.prompt,
      outputWithoutContext: p.outputWithoutContext,
      outputWithContext: p.outputWithContext,
      model: p.model,
      sandboxResult: (p.sandboxResult as "passed" | "failed" | null) ?? undefined,
      createdAt: p.createdAt.toISOString(),
    })),
    versions: row.versions.map((v) => ({ id: v.id, note: v.note, createdAt: v.createdAt.toISOString() })),
    hasSandbox: row.hasSandbox,
  }
}

async function hydrate(rows: ContextRow[]) {
  const stats = await statsFor(rows.map((r) => r.id))
  return rows.map((r) => toDomain(r, stats.get(r.id) ?? emptyStats()))
}

function buildWhere(f: ContextFilters): Prisma.ContextWhereInput {
  const terms = f.q ? normalize(f.q).split(" ").filter(Boolean) : []
  return {
    status: { in: f.includeStatuses ?? PUBLIC_STATUSES },
    ...(f.country && { countries: { has: f.country } }),
    ...(f.type && { type: f.type }),
    ...(f.category && { category: f.category }),
    ...(f.tag && { tags: { some: { tag: { name: f.tag } } } }),
    ...(terms.length > 0 && { AND: terms.map((t) => ({ searchText: { contains: t } })) }),
  }
}

function tagsCreate(tags: string[]) {
  return tags.map((name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } }))
}

export const contextRepository = {
  async list(f: ContextFilters): Promise<Paginated<Context>> {
    const where = buildWhere(f)
    const pageSize = f.pageSize ?? 12
    const page = Math.max(1, f.page ?? 1)
    const total = await prisma.context.count({ where })

    let rows: ContextRow[]
    if (!f.sort || f.sort === "popular") {
      // Popularité = copies + installations : tri en mémoire sur l'ensemble filtré (catalogue de taille modeste)
      const all = await prisma.context.findMany({ where, include })
      const stats = await statsFor(all.map((r) => r.id))
      const score = (id: string) => (stats.get(id)?.copies ?? 0) + (stats.get(id)?.installs ?? 0)
      all.sort((a, b) => score(b.id) - score(a.id) || b.lastVerifiedAt.getTime() - a.lastVerifiedAt.getTime())
      rows = all.slice((page - 1) * pageSize, page * pageSize)
      return {
        items: rows.map((r) => toDomain(r, stats.get(r.id)!)),
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      }
    }
    rows = await prisma.context.findMany({
      where,
      include,
      orderBy: f.sort === "recent" ? { createdAt: "desc" } : { lastVerifiedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return { items: await hydrate(rows), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  async findBySlug(slug: string, opts?: { includeUnpublished?: boolean }) {
    const row = await prisma.context.findUnique({ where: { slug }, include })
    if (!row) return null
    if (!opts?.includeUnpublished && !PUBLIC_STATUSES.includes(row.status)) return null
    return (await hydrate([row]))[0]
  },

  async findRawBySlug(slug: string) {
    return prisma.context.findUnique({ where: { slug }, select: { id: true, slug: true, status: true, authorId: true } })
  },

  async listSlugs() {
    const rows = await prisma.context.findMany({ where: { status: { in: PUBLIC_STATUSES } }, select: { slug: true } })
    return rows.map((r) => r.slug)
  },

  async listByAuthor(authorId: string) {
    const rows = await prisma.context.findMany({ where: { authorId }, include, orderBy: { createdAt: "desc" } })
    return hydrate(rows)
  },

  async create(input: ContextSubmission, authorId: string) {
    const row = await prisma.context.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        type: input.type,
        contentPayload: input.content,
        service: input.service,
        category: input.category,
        countries: input.pays,
        apiVersion: input.version_api,
        sourceUrl: input.source_url,
        testedWith: input.tested_with,
        status: "pending",
        searchText: buildSearchText({ ...input, countries: input.pays }),
        lastVerifiedAt: new Date(),
        authorId,
        versions: { create: { contentPayload: input.content, note: "Soumission initiale" } },
        tags: { create: tagsCreate(input.tags) },
      },
      include,
    })
    return (await hydrate([row]))[0]
  },

  /** Correction par l'auteur : nouvelle version, retour en attente de validation. */
  async update(slug: string, input: ContextSubmission, note: string) {
    const existing = await prisma.context.findUnique({ where: { slug }, select: { id: true } })
    if (!existing) return null
    const row = await prisma.$transaction(async (tx) => {
      await tx.contextTag.deleteMany({ where: { contextId: existing.id } })
      return tx.context.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          contentPayload: input.content,
          service: input.service,
          category: input.category,
          countries: input.pays,
          apiVersion: input.version_api,
          sourceUrl: input.source_url,
          testedWith: input.tested_with,
          status: "pending",
          rejectionReason: null,
          searchText: buildSearchText({ ...input, countries: input.pays }),
          versions: { create: { contentPayload: input.content, note } },
          tags: { create: tagsCreate(input.tags) },
        },
        include,
      })
    })
    return (await hydrate([row]))[0]
  },

  async setStatus(id: string, data: { status: ContextStatus; rejectionReason?: string | null; lastVerifiedAt?: Date }) {
    return prisma.context.update({ where: { id }, data })
  },

  async facets() {
    const [services, tags] = await Promise.all([
      prisma.context.groupBy({ by: ["service"], where: { status: { in: PUBLIC_STATUSES } }, _count: { _all: true } }),
      prisma.tag.findMany({
        where: { contexts: { some: { context: { status: { in: PUBLIC_STATUSES } } } } },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
    ])
    return {
      services: services.map((s) => ({ name: s.service, count: s._count._all })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      tags: tags.map((t) => t.name),
    }
  },

  async impact() {
    const published = await prisma.context.findMany({ where: { status: { in: PUBLIC_STATUSES } }, select: { id: true, service: true, countries: true } })
    const ids = published.map((p) => p.id)
    const events = await prisma.event.groupBy({ by: ["kind"], where: { contextId: { in: ids } }, _count: { _all: true } })
    const count = (k: string) => events.find((e) => e.kind === k)?._count._all ?? 0
    return {
      contexts: published.length,
      services: new Set(published.map((p) => p.service)).size,
      countries: new Set(published.flatMap((p) => p.countries)).size,
      copies: count("copy"),
      installs: count("install"),
    }
  },
}
