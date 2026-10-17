/**
 * Seed : comptes de démonstration + contextes de src/data/mock-contexts.ts.
 * Idempotent : peut être relancé sans créer de doublons.
 * Lancer : npm run db:seed
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { mockContexts, mockReports } from "../src/data/mock-contexts"
import { buildSearchText } from "../src/modules/contexts/search-text"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

export const DEMO_ACCOUNTS = {
  admin: { email: "admin@africontext.dev", password: "Admin-AfriContext-2026", name: "Administrateur" },
  dev: { email: "dev@africontext.dev", password: "Dev-AfriContext-2026", name: "Développeur démo" },
}

const VOTERS = 20

async function main() {
  const [adminHash, devHash] = await Promise.all([
    bcrypt.hash(DEMO_ACCOUNTS.admin.password, 12),
    bcrypt.hash(DEMO_ACCOUNTS.dev.password, 12),
  ])
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.admin.email },
    update: { role: "admin" },
    create: { name: DEMO_ACCOUNTS.admin.name, email: DEMO_ACCOUNTS.admin.email, passwordHash: adminHash, role: "admin" },
  })
  const dev = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.dev.email },
    update: {},
    create: { name: DEMO_ACCOUNTS.dev.name, email: DEMO_ACCOUNTS.dev.email, passwordHash: devHash },
  })

  const voters = await Promise.all(
    Array.from({ length: VOTERS }, (_, i) =>
      prisma.user.upsert({
        where: { email: `votant-${i + 1}@demo.africontext.dev` },
        update: {},
        create: { name: `Votant ${i + 1}`, email: `votant-${i + 1}@demo.africontext.dev` },
      })
    )
  )

  const authorIds = new Map<string, string>()
  for (const c of mockContexts) {
    const email = c.author.id === "u_leonie" ? DEMO_ACCOUNTS.dev.email : `${c.author.id.replace("u_", "")}@demo.africontext.dev`
    if (!authorIds.has(c.author.id)) {
      const u =
        c.author.id === "u_leonie"
          ? dev
          : await prisma.user.upsert({
              where: { email },
              update: {},
              create: { name: c.author.name, email, githubUrl: c.author.githubUrl },
            })
      authorIds.set(c.author.id, u.id)
    }
  }

  let created = 0
  for (const c of mockContexts) {
    const exists = await prisma.context.findUnique({ where: { slug: c.slug }, select: { id: true } })
    if (exists) continue
    created++
    const ctx = await prisma.context.create({
      data: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        type: c.type,
        contentPayload: c.content,
        service: c.service,
        category: c.category,
        countries: c.countries,
        apiVersion: c.apiVersion,
        sourceUrl: c.sourceUrl,
        testedWith: c.testedWith,
        status: c.status,
        searchText: buildSearchText(c),
        lastVerifiedAt: new Date(c.lastVerifiedAt),
        createdAt: new Date(c.createdAt),
        hasSandbox: c.hasSandbox,
        authorId: authorIds.get(c.author.id)!,
        versions: {
          create: [...c.versions].reverse().map((v) => ({ contentPayload: c.content, note: v.note, createdAt: new Date(v.createdAt) })),
        },
        proofs: {
          create: c.proofs.map((p) => ({
            prompt: p.prompt,
            outputWithoutContext: p.outputWithoutContext,
            outputWithContext: p.outputWithContext,
            model: p.model,
            sandboxResult: p.sandboxResult,
            createdAt: new Date(p.createdAt),
          })),
        },
        tags: { create: c.tags.map((name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })) },
      },
    })

    // Événements et votes pour que les compteurs de démo soient réels (et non codés en dur)
    const events = [
      ...Array.from({ length: c.stats.views }, () => ({ contextId: ctx.id, kind: "view" as const })),
      ...Array.from({ length: c.stats.copies }, () => ({ contextId: ctx.id, kind: "copy" as const })),
      ...Array.from({ length: c.stats.installs }, () => ({ contextId: ctx.id, kind: "install" as const })),
    ]
    if (events.length) await prisma.event.createMany({ data: events })

    const up = Math.min(c.stats.upvotes, VOTERS)
    const down = Math.min(c.stats.downvotes, VOTERS - up)
    await prisma.vote.createMany({
      data: [
        ...voters.slice(0, up).map((v) => ({ userId: v.id, contextId: ctx.id, value: 1 })),
        ...voters.slice(up, up + down).map((v) => ({ userId: v.id, contextId: ctx.id, value: -1 })),
      ],
      skipDuplicates: true,
    })
  }

  // Signalements de démo
  for (const r of mockReports) {
    const ctx = await prisma.context.findUnique({ where: { slug: r.contextSlug }, select: { id: true } })
    if (!ctx) continue
    const reporter = voters[mockReports.indexOf(r)]
    const exists = await prisma.report.findFirst({ where: { contextId: ctx.id, userId: reporter.id } })
    if (!exists) await prisma.report.create({ data: { contextId: ctx.id, userId: reporter.id, reason: "obsolete", details: r.reason } })
  }

  // Réputation des auteurs
  for (const userId of new Set(authorIds.values())) {
    const [approved, upv, downv] = await Promise.all([
      prisma.context.count({ where: { authorId: userId, status: { in: ["approved", "to_recheck"] } } }),
      prisma.vote.count({ where: { value: 1, context: { authorId: userId } } }),
      prisma.vote.count({ where: { value: -1, context: { authorId: userId } } }),
    ])
    await prisma.user.update({ where: { id: userId }, data: { reputationScore: Math.max(0, approved * 10 + upv * 2 - downv) } })
  }

  const counts = {
    utilisateurs: await prisma.user.count(),
    contextes: await prisma.context.count(),
    tags: await prisma.tag.count(),
    votes: await prisma.vote.count(),
    evenements: await prisma.event.count(),
    preuves: await prisma.proof.count(),
    signalements: await prisma.report.count(),
  }
  console.log(`✔ Seed terminé (${created} contextes créés, admin ${admin.email})`, counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
