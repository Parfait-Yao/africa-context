/**
 * Tests d'intégration des règles métier sur PostgreSQL.
 * Base dédiée requise : TEST_DATABASE_URL=postgresql://.../africontext_test (migrations appliquées).
 *   TEST_DATABASE_URL=... npx prisma migrate deploy && TEST_DATABASE_URL=... npm test
 */
import { beforeAll, describe, expect, it } from "vitest"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

const enabled = Boolean(process.env.TEST_DATABASE_URL)
const d = enabled ? describe : describe.skip

const content = REQUIRED_SECTIONS.map((s) => `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`).join("\n\n")
const submission = (slug: string) => ({
  slug,
  title: "Service test — paiement",
  description: "Contexte de test pour les règles métier d'AfriContext.",
  type: "cursorrules",
  service: "TestPay",
  category: "paiement-mobile",
  pays: ["SN", "CI"],
  version_api: "v1",
  source_url: "https://docs.testpay.example",
  tested_with: ["cursor"],
  tags: ["fintech", "test"],
  content,
})

d("règles métier (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/db")
  const { contextService } = await import("@/modules/contexts/context.service")
  const { votesService } = await import("@/modules/votes/votes.service")
  const { reportsService } = await import("@/modules/reports/reports.service")
  const { eventsService } = await import("@/modules/events/events.service")
  const { usersService } = await import("@/modules/users/users.service")

  let author: { id: string }, admin: { id: string }, voters: { id: string }[]

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ModerationLog","Event","Report","Vote","Proof","ContextTag","Tag","ContextVersion","Context","Account","Session","User" CASCADE'
    )
    author = await prisma.user.create({ data: { name: "Auteur", email: "auteur@test.dev" } })
    admin = await prisma.user.create({ data: { name: "Admin", email: "admin@test.dev", role: "admin" } })
    voters = await Promise.all([1, 2, 3].map((i) => prisma.user.create({ data: { name: `V${i}`, email: `v${i}@test.dev` } })))
  })

  it("une soumission valide démarre en attente et n'est pas publique", async () => {
    const r = await contextService.submit(submission("testpay-checkout"), author.id)
    expect(r.ok).toBe(true)
    expect(await contextService.getBySlug("testpay-checkout")).toBeNull()
    expect((await contextService.list({ q: "testpay" })).total).toBe(0)
  })

  it("refuse le signalement d'un contexte non publié", async () => {
    await expect(reportsService.create("testpay-checkout", voters[0].id, { reason: "obsolete" })).rejects.toMatchObject({ status: 404 })
  })

  it("refuse un slug déjà pris et une soumission avec secret", async () => {
    const dup = await contextService.submit(submission("testpay-checkout"), author.id)
    expect(dup.ok).toBe(false)
    const secret = await contextService.submit({ ...submission("x-secret"), content: content + "\nsk_live_51HxYzAbCdEfGhIjKl" }, author.id)
    expect(secret.ok).toBe(false)
  })

  it("contrôle les transitions de modération et exige un motif de rejet", async () => {
    await expect(contextService.moderate("testpay-checkout", "to_recheck", admin)).rejects.toMatchObject({ status: 409 })
    await expect(contextService.moderate("testpay-checkout", "rejected", admin)).rejects.toMatchObject({ status: 400 })
    await contextService.moderate("testpay-checkout", "rejected", admin, "Source incomplète")
    const rejected = await contextService.getForOwner("testpay-checkout")
    expect(rejected?.rejectionReason).toBe("Source incomplète")
    await expect(contextService.moderate("testpay-checkout", "approved", admin)).rejects.toMatchObject({ status: 409 })
  })

  it("refuse de publier un contexte incomplet", async () => {
    const incomplete = await prisma.context.create({
      data: { slug: "incomplet", title: "Incomplet", description: "x", type: "cursorrules", contentPayload: "## Authentification\nx", service: "X", category: "sms", countries: ["CI"], apiVersion: "v1", sourceUrl: "https://x.example", testedWith: [], lastVerifiedAt: new Date(), authorId: author.id },
    })
    await expect(contextService.moderate(incomplete.slug, "approved", admin)).rejects.toMatchObject({ status: 422 })
  })

  it("la resoumission repasse en attente, puis l'approbation publie", async () => {
    const r = await contextService.resubmit("testpay-checkout", submission("testpay-checkout"), { id: author.id, role: "user" })
    expect(r.ok && r.context.status).toBe("pending")
    await expect(contextService.resubmit("testpay-checkout", submission("testpay-checkout"), { id: voters[0].id, role: "user" })).rejects.toMatchObject({ status: 403 })
    await contextService.moderate("testpay-checkout", "approved", admin)
    expect((await contextService.list({ q: "sénégal testpay" })).total).toBe(1)
    expect((await prisma.moderationLog.count())).toBe(2)
  })

  it("un seul vote par utilisateur, pas de vote sur son propre contexte", async () => {
    await votesService.vote("testpay-checkout", voters[0].id, 1)
    const again = await votesService.vote("testpay-checkout", voters[0].id, 1)
    expect(again).toMatchObject({ up: 1, down: 0, mine: 1 })
    const switched = await votesService.vote("testpay-checkout", voters[0].id, -1)
    expect(switched).toMatchObject({ up: 0, down: 1 })
    await expect(votesService.vote("testpay-checkout", author.id, 1)).rejects.toMatchObject({ status: 403 })
  })

  it("3 signalements ouverts passent le contexte « à revérifier »", async () => {
    await reportsService.create("testpay-checkout", voters[0].id, { reason: "obsolete" })
    await expect(reportsService.create("testpay-checkout", voters[0].id, { reason: "obsolete" })).rejects.toMatchObject({ status: 409 })
    await reportsService.create("testpay-checkout", voters[1].id, { reason: "incorrect" })
    const third = await reportsService.create("testpay-checkout", voters[2].id, { reason: "incorrect" })
    expect(third.autoRecheck).toBe(true)
    expect((await contextService.getBySlug("testpay-checkout"))?.status).toBe("to_recheck")
  })

  it("compte copies et installations, et une seule vue par visiteur et par jour", async () => {
    await eventsService.track("testpay-checkout", "view", { visitorId: "visiteur-1" })
    await eventsService.track("testpay-checkout", "view", { visitorId: "visiteur-1" })
    await eventsService.track("testpay-checkout", "view", { visitorId: "robot", userAgent: "Googlebot" })
    await eventsService.track("testpay-checkout", "copy")
    await eventsService.track("testpay-checkout", "install")
    const ctx = await contextService.getBySlug("testpay-checkout")
    expect(ctx?.stats).toMatchObject({ views: 1, copies: 1, installs: 1 })
  })

  it("calcule la réputation de l'auteur", async () => {
    const score = await usersService.recomputeReputation(author.id)
    expect(score).toBe(10 - 1) // contexte approuvé (+10), un vote négatif (−1)
  })

  it("inscription : refuse un email déjà utilisé et vérifie le mot de passe", async () => {
    expect((await usersService.register({ name: "Nouveau", email: "Nouveau@Test.dev", password: "motdepasse123" })).ok).toBe(true)
    expect((await usersService.register({ name: "Nouveau", email: "nouveau@test.dev", password: "motdepasse123" })).ok).toBe(false)
    expect(await usersService.verifyCredentials("nouveau@test.dev", "motdepasse123")).not.toBeNull()
    expect(await usersService.verifyCredentials("nouveau@test.dev", "mauvais")).toBeNull()
  })
})
