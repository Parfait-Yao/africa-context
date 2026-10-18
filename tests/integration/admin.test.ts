/**
 * Tests d'intégration de l'espace administrateur (règles métier côté serveur) sur PostgreSQL.
 * Base dédiée requise : TEST_DATABASE_URL (voir services.test.ts).
 */
import { beforeAll, describe, expect, it } from "vitest"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

const enabled = Boolean(process.env.TEST_DATABASE_URL)
const d = enabled ? describe : describe.skip

const content = REQUIRED_SECTIONS.map((s) =>
  s.key === "example" ? `## ${s.title}\n\`\`\`ts\nconst ok = true\n\`\`\`` : `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`
).join("\n\n")
const submission = (slug: string, service = "AdminPay") => ({
  slug,
  title: `${service} — paiement ${slug}`,
  description: "Contexte de test pour l'espace administrateur d'AfriContext.",
  type: "cursorrules",
  service,
  category: "paiement-mobile",
  pays: ["CI"],
  version_api: "v2",
  source_url: "https://docs.adminpay.example",
  tested_with: [],
  tags: ["admin-test"],
  content,
})

d("espace administrateur (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/db")
  const { contextService } = await import("@/modules/contexts/context.service")
  const { reportsService } = await import("@/modules/reports/reports.service")
  const { usersService } = await import("@/modules/users/users.service")
  const { adminContextsService, adminContextFiltersSchema } = await import("@/modules/admin/admin-contexts.service")
  const { adminUsersService } = await import("@/modules/admin/admin-users.service")
  const { catalogService } = await import("@/modules/admin/catalog.service")

  let author: { id: string }, admin: { id: string }, admin2: { id: string }, reporter: { id: string }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ModerationLog","Event","Report","Vote","Proof","ContextTag","Tag","ContextVersion","Context","Account","Session","User" CASCADE'
    )
    author = await prisma.user.create({ data: { name: "Auteur", email: "auteur@admin.test" } })
    admin = await prisma.user.create({ data: { name: "Admin", email: "admin@admin.test", role: "admin" } })
    admin2 = await prisma.user.create({ data: { name: "Admin 2", email: "admin2@admin.test", role: "admin" } })
    reporter = await prisma.user.create({ data: { name: "Signaleur", email: "signal@admin.test" } })
    for (const slug of ["adminpay-a", "adminpay-b"]) expect((await contextService.submit(submission(slug), author.id)).ok).toBe(true)
    await contextService.moderate("adminpay-a", "approved", admin)
  })

  describe("contextes", () => {
    it("liste admin : tous statuts, filtres statut / service / recherche / date", async () => {
      const all = await adminContextsService.list(adminContextFiltersSchema.parse({}))
      expect(all.total).toBe(2)
      expect((await adminContextsService.list(adminContextFiltersSchema.parse({ status: "pending" }))).items.map((c) => c.slug)).toEqual(["adminpay-b"])
      expect((await adminContextsService.list(adminContextFiltersSchema.parse({ service: "Inconnu" }))).total).toBe(0)
      expect((await adminContextsService.list(adminContextFiltersSchema.parse({ q: "adminpay-b" }))).total).toBe(1)
      expect((await adminContextsService.list(adminContextFiltersSchema.parse({ to: "2000-01-01" }))).total).toBe(0)
      // Paramètres invalides ignorés, pas d'erreur
      expect(adminContextFiltersSchema.parse({ status: "archived", page: "-3", sort: "x" })).toMatchObject({ status: undefined, page: 1, sort: "recent" })
    })

    it("dépublier exige un motif, retire du catalogue et laisse une trace", async () => {
      await expect(contextService.moderate("adminpay-a", "rejected", admin)).rejects.toMatchObject({ status: 400 })
      await contextService.moderate("adminpay-a", "rejected", admin, "Endpoint obsolète")
      expect(await contextService.getBySlug("adminpay-a")).toBeNull()
      const log = await prisma.moderationLog.findFirst({ where: { context: { slug: "adminpay-a" }, toStatus: "rejected" } })
      expect(log).toMatchObject({ fromStatus: "approved", reason: "Endpoint obsolète" })
      // Un contexte rejeté ne se republie pas directement : il faut une correction de l'auteur
      await expect(contextService.moderate("adminpay-a", "approved", admin)).rejects.toMatchObject({ status: 409 })
    })

    it("la fiche admin expose la validation et les versions", async () => {
      const detail = await adminContextsService.detail("adminpay-b")
      expect(detail?.checks.find((c) => c.key === "sections")?.level).toBe("ok")
      expect(detail?.versions).toHaveLength(1)
      expect(detail?.extra.author.email).toBe("auteur@admin.test")
    })

    it("un admin ne supprime pas un contexte publié, mais peut supprimer un contexte non publié", async () => {
      expect((await contextService.submit(submission("adminpay-c"), author.id)).ok).toBe(true)
      await contextService.moderate("adminpay-c", "approved", admin)
      await expect(adminContextsService.remove("adminpay-c", { id: admin.id, role: "admin" })).rejects.toMatchObject({ status: 409 })
      await adminContextsService.remove("adminpay-b", { id: admin.id, role: "admin" })
      expect(await prisma.context.findUnique({ where: { slug: "adminpay-b" } })).toBeNull()
    })
  })

  describe("signalements", () => {
    it("classer ne modifie pas le contexte ; la décision est tracée ; pas de double traitement", async () => {
      const r = await reportsService.create("adminpay-c", reporter.id, { reason: "obsolete" })
      await reportsService.resolve(r.id, "dismiss", admin, "Faux positif")
      const stored = await prisma.report.findUnique({ where: { id: r.id } })
      expect(stored).toMatchObject({ status: "dismissed", resolvedById: admin.id, resolutionNote: "Faux positif" })
      expect((await prisma.context.findUnique({ where: { slug: "adminpay-c" } }))?.status).toBe("approved")
      await expect(reportsService.resolve(r.id, "recheck", admin)).rejects.toMatchObject({ status: 409 })
    })

    it("« à revérifier » passe le contexte publié en to_recheck et journalise", async () => {
      const r = await reportsService.create("adminpay-c", reporter.id, { reason: "incorrect", details: "montant en centimes" })
      const res = await reportsService.resolve(r.id, "recheck", admin)
      expect(res).toMatchObject({ status: "resolved", contextStatus: "to_recheck" })
      const log = await prisma.moderationLog.findFirst({ where: { context: { slug: "adminpay-c" }, toStatus: "to_recheck" } })
      expect(log?.reason).toMatch(/Signalement \(incorrect\)/)
    })

    it("liste admin filtrée par statut et motif", async () => {
      expect((await reportsService.listAdmin({ status: "dismissed", page: 1 })).total).toBe(1)
      expect((await reportsService.listAdmin({ reason: "incorrect", page: 1 })).total).toBe(1)
    })
  })

  describe("utilisateurs et rôles", () => {
    it("un admin ne modifie jamais son propre compte", async () => {
      await expect(adminUsersService.update(admin, admin.id, { role: "user" })).rejects.toMatchObject({ status: 403 })
      await expect(adminUsersService.update(admin, admin.id, { suspended: true })).rejects.toMatchObject({ status: 403 })
    })

    it("le dernier administrateur actif ne peut pas être rétrogradé", async () => {
      await adminUsersService.update(admin, admin2.id, { role: "user" })
      await expect(adminUsersService.update(admin2, admin.id, { role: "user" })).rejects.toMatchObject({ status: 409 })
      expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.role).toBe("admin")
    })

    it("un admin ne peut pas être suspendu ; un compte suspendu ne peut pas être promu", async () => {
      await adminUsersService.update(admin, admin2.id, { role: "admin" })
      await expect(adminUsersService.update(admin, admin2.id, { suspended: true })).rejects.toMatchObject({ status: 409 })
      await adminUsersService.update(admin, reporter.id, { suspended: true })
      await expect(adminUsersService.update(admin, reporter.id, { role: "admin" })).rejects.toMatchObject({ status: 409 })
    })

    it("suspension : bloque la connexion OAuth, est visible et réversible", async () => {
      await prisma.user.update({ where: { id: reporter.id }, data: { githubId: "gh-42" } })
      expect(await usersService.isSuspendedOAuth("github", "gh-42")).toBe(true)
      expect(await usersService.isSuspendedOAuth("google", "inconnu", "signal@admin.test")).toBe(true)
      const list = await adminUsersService.list({ state: "suspended", sort: "recent", page: 1 })
      expect(list.items.map((u) => u.id)).toEqual([reporter.id])
      expect(list.items[0]).not.toHaveProperty("passwordHash")
      await adminUsersService.update(admin, reporter.id, { suspended: false })
      expect(await usersService.isSuspendedOAuth("github", "gh-42")).toBe(false)
    })

    it("refuse les changements mal formés", async () => {
      const { userUpdateSchema } = await import("@/modules/admin/admin-users.service")
      expect(userUpdateSchema.safeParse({ role: "superadmin" }).success).toBe(false)
      expect(userUpdateSchema.safeParse({ role: "admin", suspended: true }).success).toBe(false)
    })
  })

  describe("catalogue de référence", () => {
    it("renommer un tag met à jour la recherche ; un tag utilisé ne se supprime pas", async () => {
      const tag = await prisma.tag.findUniqueOrThrow({ where: { name: "admin-test" } })
      await catalogService.renameTag(tag.id, "Paiement-Admin")
      expect((await contextService.list({ q: "paiement-admin" })).total).toBe(1)
      await expect(catalogService.deleteTag(tag.id)).rejects.toMatchObject({ status: 409 })
      const unused = await catalogService.createTag("inutilise")
      await expect(catalogService.createTag("inutilise")).rejects.toMatchObject({ status: 409 })
      await catalogService.deleteTag(unused.id)
    })

    it("renommer un service le fusionne et met à jour la recherche", async () => {
      expect((await contextService.submit(submission("otherpay-a", "OtherPay"), author.id)).ok).toBe(true)
      const r = await catalogService.renameService({ from: "AdminPay", to: "OtherPay" })
      expect(r).toMatchObject({ merged: true })
      expect(await prisma.context.count({ where: { service: "AdminPay" } })).toBe(0)
      expect((await contextService.list({ q: "otherpay" })).total).toBe(1) // seul adminpay-c est publié
      await expect(catalogService.renameService({ from: "Inexistant", to: "X2" })).rejects.toMatchObject({ status: 404 })
    })
  })
})
