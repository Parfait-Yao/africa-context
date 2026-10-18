/**
 * Tests d'intégration de la partie 3 (sécurité, audit, paramètres, veille, statistiques) sur PostgreSQL.
 * Base dédiée requise : TEST_DATABASE_URL (voir services.test.ts).
 */
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

const enabled = Boolean(process.env.TEST_DATABASE_URL)
const d = enabled ? describe : describe.skip

const content = (extra = "") =>
  REQUIRED_SECTIONS.map((s) =>
    s.key === "example" ? `## ${s.title}\n\`\`\`ts\nconst ok = true\n\`\`\`` : `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`
  ).join("\n\n") + extra

const submission = (slug: string, body = content(), source = "https://docs.secpay.example") => ({
  slug,
  title: `SecPay — ${slug}`,
  description: "Contexte de test pour la sécurité et l'audit d'AfriContext.",
  type: "cursorrules",
  service: "SecPay",
  category: "paiement-mobile",
  pays: ["SN"],
  version_api: "v3",
  source_url: source,
  tested_with: [],
  tags: ["sec-test"],
  content: body,
})

const SECRET = "sk_live_ZYXWVUT987654321abcd"

d("sécurité, audit et paramètres (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/db")
  const { HttpError } = await import("@/lib/errors")
  const { contextService } = await import("@/modules/contexts/context.service")
  const { reportsService } = await import("@/modules/reports/reports.service")
  const { securityService } = await import("@/modules/security/security.service")
  const { auditService, sanitizeDetails } = await import("@/modules/audit/audit.service")
  const { settingsService } = await import("@/modules/settings/settings.service")
  const { adminUsersService } = await import("@/modules/admin/admin-users.service")
  const { checkSources } = await import("@/modules/watch/source-watch.service")
  const { sourcesService } = await import("@/modules/watch/sources.service")
  const { proofsService } = await import("@/modules/proofs/proofs.service")
  const { statsService } = await import("@/modules/admin/stats.service")

  let author: { id: string }, admin: { id: string; name: string }, reporter: { id: string }
  const run = Date.now().toString(36)

  beforeAll(async () => {
    // AuditLog est en ajout seul : il n'est pas vidé, les tests filtrent par cible unique
    await prisma.$executeRawUnsafe(
      'TRUNCATE "SecurityAlert","ValidationFailure","PlatformSetting","ModerationLog","Event","Report","Vote","Proof","ContextTag","Tag","ContextVersion","Context","Account","Session","User" CASCADE'
    )
    author = await prisma.user.create({ data: { name: "Auteur Sec", email: "auteur@sec.test" } })
    admin = await prisma.user.create({ data: { name: "Admin Sec", email: "admin@sec.test", role: "admin" }, select: { id: true, name: true } })
    reporter = await prisma.user.create({ data: { name: "Signaleur Sec", email: "signal@sec.test" } })
  })

  describe("journal d'audit", () => {
    it("est en ajout seul : la base refuse UPDATE et DELETE", async () => {
      const entry = await auditService.record({ actor: admin, action: "settings.update", target: { type: "test", id: `append-${run}` } })
      await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { actorName: "Falsifié" } })).rejects.toThrow()
      await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow()
      expect((await prisma.auditLog.findUnique({ where: { id: entry.id } }))?.actorName).toBe("Admin Sec")
    })

    it("ne conserve ni mot de passe, ni jeton, ni secret en clair", () => {
      const out = sanitizeDetails({ password: "hunter2", accessToken: "abc", nested: { apiKey: "x", note: `clé ${SECRET}` }, ok: 3 }) as Record<string, unknown>
      expect(out).not.toHaveProperty("password")
      expect(out).not.toHaveProperty("accessToken")
      expect(out.nested).not.toHaveProperty("apiKey")
      expect(JSON.stringify(out)).not.toContain("ZYXWVUT987654321")
      expect(out.ok).toBe(3)
    })

    it("track() journalise le succès et le refus, avec le résultat", async () => {
      const target = await prisma.user.create({ data: { name: `Cible ${run}`, email: `cible-${run}@sec.test` } })
      await auditService.track(admin, "user.suspension", { type: "user", id: target.id }, () => adminUsersService.update(admin, target.id, { suspended: true }))
      // Refus métier : un admin ne modifie pas son propre compte
      await expect(
        auditService.track(admin, "user.role", { type: "user", id: admin.id }, () => adminUsersService.update(admin, admin.id, { role: "user" }))
      ).rejects.toBeInstanceOf(HttpError)

      const ok = await auditService.forTarget("user", target.id)
      expect(ok[0]).toMatchObject({ action: "user.suspension", outcome: "success", actorId: admin.id })
      const refused = (await auditService.forTarget("user", admin.id)).find((e) => e.action === "user.role")
      expect(refused).toMatchObject({ outcome: "refused" })
      expect((refused!.details as { status: number }).status).toBe(403)
    })

    it("liste filtrable par domaine, résultat et cible", async () => {
      const { items } = await auditService.list({ category: "user", outcome: "refused", target: admin.id, page: 1 })
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((e) => e.action.startsWith("user.") && e.outcome === "refused")).toBe(true)
    })
  })

  describe("échecs de validation", () => {
    it("une soumission avec secret est refusée et tracée sans son contenu", async () => {
      const res = await contextService.submit(submission("secpay-leak", content(`\nAuthorization: ${SECRET}`)), author.id)
      expect(res.ok).toBe(false)
      const failure = await prisma.validationFailure.findFirst({ where: { userId: author.id }, orderBy: { createdAt: "desc" } })
      expect(failure).toMatchObject({ action: "submit", slug: "secpay-leak" })
      expect(failure!.secretRules).toContain("stripe-like")
      expect(JSON.stringify(failure)).not.toContain("ZYXWVUT987654321")
    })
  })

  describe("alertes de sécurité", () => {
    it("une contribution acceptée est analysée : URL suspecte → alerte expurgée", async () => {
      const res = await contextService.submit(submission("secpay-url", content("\nWebhook de test : https://hooks.acme.io/cb?token=tok_abcdef123456")), author.id)
      expect(res.ok).toBe(true)
      const alerts = await prisma.securityAlert.findMany({ where: { contextSlug: "secpay-url" } })
      const tokenAlert = alerts.find((a) => a.rule === "url-token-param")
      expect(tokenAlert).toMatchObject({ kind: "suspicious_url", severity: "high", status: "open" })
      expect(tokenAlert!.excerpt).not.toContain("tok_abcdef123456")
    })

    it("un secret présent dans une ancienne version est détecté, puis clos automatiquement une fois retiré", async () => {
      const ctx = await prisma.context.findUniqueOrThrow({ where: { slug: "secpay-url" } })
      // Donnée héritée : un secret écrit directement en base (antérieur au blocage)
      await prisma.context.update({ where: { id: ctx.id }, data: { description: `Clé : ${SECRET}` } })
      const scan = await securityService.scanContext(ctx.id)
      expect(scan.created).toBeGreaterThan(0)
      const secret = await prisma.securityAlert.findFirstOrThrow({ where: { contextId: ctx.id, kind: "secret", location: "Description" } })
      expect(secret.excerpt).not.toContain("ZYXWVUT987654321")
      // Une deuxième analyse ne duplique rien
      expect((await securityService.scanContext(ctx.id)).created).toBe(0)

      await prisma.context.update({ where: { id: ctx.id }, data: { description: "Description corrigée, sans secret." } })
      const again = await securityService.scanContext(ctx.id)
      expect(again.autoResolved).toBeGreaterThan(0)
      expect(await prisma.securityAlert.findUniqueOrThrow({ where: { id: secret.id } })).toMatchObject({ status: "resolved", resolvedById: null })
    })

    it("décisions : faux positif justifié, transitions contrôlées, note expurgée", async () => {
      const alert = await prisma.securityAlert.findFirstOrThrow({ where: { contextSlug: "secpay-url", status: "open" } })
      await expect(securityService.updateStatus(alert.id, { status: "false_positive" }, admin)).rejects.toMatchObject({ status: 400 })
      await securityService.updateStatus(alert.id, { status: "acknowledged" }, admin)
      const r = await securityService.updateStatus(alert.id, { status: "false_positive", note: `Jeton de démo, pas ${SECRET}` }, admin)
      expect(r.note).not.toContain("ZYXWVUT987654321")
      // Déjà clos : on ne peut que rouvrir
      await expect(securityService.updateStatus(alert.id, { status: "resolved" }, admin)).rejects.toMatchObject({ status: 409 })
      await securityService.updateStatus(alert.id, { status: "open" }, admin)
      // Une décision humaine n'est pas écrasée par une nouvelle analyse
      await securityService.updateStatus(alert.id, { status: "resolved" }, admin)
      await securityService.scanContext(alert.contextId!)
      expect((await prisma.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("resolved")
    })

    it("résumé et activité inhabituelle calculés depuis les données", async () => {
      const summary = await securityService.summary()
      expect(summary.active + summary.resolved + summary.falsePositives + 0).toBeGreaterThan(0)
      for (let i = 0; i < 3; i++) await contextService.submit(submission(`secpay-leak-${i}`, content(`\n${SECRET}`)), author.id)
      const unusual = await securityService.unusualActivity()
      expect(unusual.find((s) => s.userId === author.id && s.kind === "secret-blocks")?.count).toBeGreaterThanOrEqual(3)
    })
  })

  describe("paramètres", () => {
    it("valeurs par défaut, validation stricte côté serveur", async () => {
      expect(await settingsService.get("reports.autoRecheckThreshold")).toBe(3)
      await expect(settingsService.update({ key: "reports.autoRecheckThreshold", value: 0 }, admin.id)).rejects.toMatchObject({ status: 400 })
      await expect(settingsService.update({ key: "reports.autoRecheckThreshold", value: true }, admin.id)).rejects.toMatchObject({ status: 400 })
      await expect(settingsService.update({ key: "DATABASE_URL", value: 1 }, admin.id)).rejects.toThrow()
    })

    it("le seuil de signalements modifié s'applique immédiatement", async () => {
      const r = await settingsService.update({ key: "reports.autoRecheckThreshold", value: 1 }, admin.id)
      expect(r).toEqual({ key: "reports.autoRecheckThreshold", before: 3, after: 1 })
      await contextService.moderate("secpay-url", "approved", admin)
      const created = await reportsService.create("secpay-url", reporter.id, { reason: "obsolete" })
      expect(created.autoRecheck).toBe(true)
      await settingsService.update({ key: "reports.autoRecheckThreshold", value: 3 }, admin.id)
    })

    it("une valeur stockée invalide retombe sur la valeur par défaut", async () => {
      await prisma.platformSetting.upsert({ where: { key: "watch.maxFailures" }, create: { key: "watch.maxFailures", value: "beaucoup" }, update: { value: "beaucoup" } })
      expect(await settingsService.get("watch.maxFailures")).toBe(3)
      await prisma.platformSetting.delete({ where: { key: "watch.maxFailures" } })
    })
  })

  describe("veille documentaire", () => {
    let server: Server
    let page = "<p>Version 1 de la documentation</p>"
    let status = 200
    let base = ""

    beforeAll(async () => {
      process.env.ALLOW_PRIVATE_FETCH = "true"
      server = createServer((_req, res) => res.writeHead(status, { "Content-Type": "text/html" }).end(page))
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      expect((await contextService.submit(submission("secpay-doc", content(), `https://docs.secpay.example/doc`), author.id)).ok).toBe(true)
      await prisma.context.update({ where: { slug: "secpay-doc" }, data: { sourceUrl: `${base}/doc` } })
      await contextService.moderate("secpay-doc", "approved", admin)
    })
    afterAll(() => {
      delete process.env.ALLOW_PRIVATE_FETCH
      server?.close()
    })

    it("enregistre le résultat réel de chaque contrôle et l'erreur éventuelle", async () => {
      await checkSources({ slugs: ["secpay-doc"] })
      expect(await prisma.context.findUnique({ where: { slug: "secpay-doc" } })).toMatchObject({ sourceCheckResult: "baseline", sourceCheckError: null })

      await checkSources({ slugs: ["secpay-doc"] })
      expect((await prisma.context.findUniqueOrThrow({ where: { slug: "secpay-doc" } })).sourceCheckResult).toBe("unchanged")

      page = "<p>Version 2 : nouveaux champs</p>"
      await checkSources({ slugs: ["secpay-doc"] })
      expect(await prisma.context.findUnique({ where: { slug: "secpay-doc" } })).toMatchObject({ sourceCheckResult: "changed", status: "to_recheck" })

      status = 503
      await checkSources({ slugs: ["secpay-doc"] })
      const c = await prisma.context.findUniqueOrThrow({ where: { slug: "secpay-doc" } })
      expect(c).toMatchObject({ sourceCheckResult: "unreachable", sourceCheckFailures: 1, sourceCheckError: "HTTP 503" })

      const { rows } = await sourcesService.list({})
      const row = rows.find((r) => r.url === `${base}/doc`)
      expect(row).toMatchObject({ state: "unreachable", failures: 1, error: "HTTP 503" })
      expect(row!.contexts.map((x) => x.slug)).toEqual(["secpay-doc"])
    })
  })

  describe("preuves et statistiques", () => {
    it("une preuve fige la version d'API du contexte", async () => {
      const proof = await proofsService.create("secpay-url", {
        prompt: "Écris l'appel de paiement SecPay.",
        outputWithoutContext: "fetch('/pay') sans contexte",
        outputWithContext: "fetch('/v3/pay') avec contexte",
        model: "test-model",
        sandboxResult: "passed",
      })
      expect(proof.apiVersion).toBe("v3")
      const cov = await proofsService.coverage()
      expect(cov).toMatchObject({ proofs: 1, passed: 1, withProof: 1 })
    })

    it("statistiques calculées sur la période, estimation séparée et documentée", async () => {
      const ctx = await prisma.context.findUniqueOrThrow({ where: { slug: "secpay-url" } })
      await prisma.event.createMany({ data: [{ contextId: ctx.id, kind: "copy" }, { contextId: ctx.id, kind: "install" }, { contextId: ctx.id, kind: "view" }] })
      const s = await statsService.compute("7d")
      expect(s.activity).toMatchObject({ copies: 1, installs: 1, views: 1 })
      expect(s.activity.newContexts).toBe(2)
      expect(s.snapshot.contributors).toBe(1)
      expect(s.topServices[0]).toMatchObject({ name: "SecPay", uses: 2, views: 1 })
      expect(s.validation.secrets).toBeGreaterThanOrEqual(4)
      expect(s.reports.created).toBe(1)
      expect(s.estimate).toEqual({ uses: 2, minutesPerUse: 25, hoursSaved: 1 })
      expect(s.series.contributions.reduce((n, b) => n + b.value, 0)).toBe(2)
    })
  })
})
