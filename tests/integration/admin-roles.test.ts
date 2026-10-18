/**
 * Séparation des rôles : l'administrateur contrôle, vérifie et valide ; il ne publie pas.
 * Retrait de compte : uniquement sans contexte ni historique, jamais un admin ni soi-même.
 * Base dédiée requise : TEST_DATABASE_URL (voir services.test.ts).
 */
import { beforeAll, describe, expect, it } from "vitest"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

const enabled = Boolean(process.env.TEST_DATABASE_URL)
const d = enabled ? describe : describe.skip

const content = REQUIRED_SECTIONS.map((s) =>
  s.key === "example" ? `## ${s.title}\n\`\`\`ts\nconst ok = true\n\`\`\`` : `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`
).join("\n\n")
const submission = (slug: string) => ({
  slug,
  title: `RolePay — paiement ${slug}`,
  description: "Contexte de test pour la séparation des rôles d'AfriContext.",
  type: "cursorrules",
  service: "RolePay",
  category: "paiement-mobile",
  pays: ["SN"],
  version_api: "v1",
  source_url: "https://docs.rolepay.example",
  tested_with: [],
  tags: [],
  content,
})

d("rôles de l'administrateur (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/db")
  const { contextService } = await import("@/modules/contexts/context.service")
  const { adminUsersService } = await import("@/modules/admin/admin-users.service")

  let author: { id: string }, admin: { id: string }, voter: { id: string }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ModerationLog","Event","Report","Vote","Proof","ContextTag","Tag","ContextVersion","Context","Account","Session","User" CASCADE'
    )
    author = await prisma.user.create({ data: { name: "Auteur", email: "auteur@roles.test" } })
    admin = await prisma.user.create({ data: { name: "Admin", email: "admin@roles.test", role: "admin" } })
    voter = await prisma.user.create({ data: { name: "Votant", email: "votant@roles.test" } })
  })

  it("un administrateur ne peut pas soumettre de contexte", async () => {
    await expect(contextService.submit(submission("rolepay-admin"), admin.id)).rejects.toMatchObject({ status: 403 })
    expect(await prisma.context.count({ where: { slug: "rolepay-admin" } })).toBe(0)
  })

  it("un administrateur ne peut pas corriger le contexte d'un contributeur ; il le valide", async () => {
    expect((await contextService.submit(submission("rolepay-a"), author.id)).ok).toBe(true)
    await expect(contextService.resubmit("rolepay-a", submission("rolepay-a"), { id: admin.id, role: "admin" })).rejects.toMatchObject({ status: 403 })
    await contextService.moderate("rolepay-a", "approved", admin)
    expect((await contextService.getBySlug("rolepay-a"))?.status).toBe("approved")
  })

  it("un contributeur promu administrateur perd la publication, sans perdre ses contextes", async () => {
    await prisma.user.update({ where: { id: author.id }, data: { role: "admin" } })
    await expect(contextService.submit(submission("rolepay-b"), author.id)).rejects.toMatchObject({ status: 403 })
    expect(await contextService.getBySlug("rolepay-a")).not.toBeNull()
    await prisma.user.update({ where: { id: author.id }, data: { role: "user" } })
  })

  it("retrait de compte : refusé pour soi, un admin ou un compte avec contextes", async () => {
    await expect(adminUsersService.remove(admin, admin.id)).rejects.toMatchObject({ status: 403 })
    const admin2 = await prisma.user.create({ data: { name: "Admin 2", email: "admin2@roles.test", role: "admin" } })
    await expect(adminUsersService.remove(admin, admin2.id)).rejects.toMatchObject({ status: 409 })
    await expect(adminUsersService.remove(admin, author.id)).rejects.toMatchObject({ status: 409 })
  })

  it("retrait de compte : supprime le compte et ses votes, renvoie les auteurs à recalculer", async () => {
    const ctx = await prisma.context.findUniqueOrThrow({ where: { slug: "rolepay-a" } })
    await prisma.vote.create({ data: { userId: voter.id, contextId: ctx.id, value: 1 } })
    const r = await adminUsersService.remove(admin, voter.id)
    expect(r.authors).toEqual([author.id])
    expect(await prisma.user.findUnique({ where: { id: voter.id } })).toBeNull()
    expect(await prisma.vote.count({ where: { userId: voter.id } })).toBe(0)
    await expect(adminUsersService.remove(admin, voter.id)).rejects.toMatchObject({ status: 404 })
  })
})
