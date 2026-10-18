import "dotenv/config"
import { expect, test } from "@playwright/test"
import { expectNoHorizontalScroll, login } from "./helpers"

/** Pages et routes ajoutées à l'espace administrateur (partie 3). */
const PAGES = [
  { path: "/admin/stats", title: "Statistiques et impact" },
  { path: "/admin/security", title: "Sécurité" },
  { path: "/admin/proofs", title: "Preuves et tests" },
  { path: "/admin/sandboxes", title: "Sandboxes" },
  { path: "/admin/sources", title: "Vérification de la documentation" },
  { path: "/admin/audit", title: "Journal d'audit" },
  { path: "/admin/settings", title: "Paramètres" },
]

const MUTATIONS = [
  { method: "POST", url: "/api/admin/security/scan", data: {} },
  { method: "PATCH", url: "/api/admin/security/alerts/inconnue", data: { status: "resolved" } },
  { method: "POST", url: "/api/admin/sources/check", data: { url: "https://example.com" } },
  { method: "PATCH", url: "/api/admin/settings", data: { key: "watch.maxFailures", value: 5 } },
] as const

test.describe("permissions de l'espace administrateur", () => {
  test("visiteur anonyme : pages redirigées vers la connexion, API refusées (401)", async ({ page, request }) => {
    for (const p of PAGES) {
      await page.goto(p.path)
      await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=${encodeURIComponent(p.path)}`))
    }
    for (const m of MUTATIONS) {
      const res = await request.fetch(m.url, { method: m.method, data: m.data })
      expect(res.status(), `${m.method} ${m.url}`).toBe(401)
    }
  })

  test("contributeur : pages redirigées vers son tableau de bord, API refusées (403)", async ({ page }) => {
    await login(page, "dev")
    for (const p of PAGES) {
      await page.goto(p.path)
      await expect(page).toHaveURL(/\/dashboard/)
    }
    for (const m of MUTATIONS) {
      const res = await page.request.fetch(m.url, { method: m.method, data: m.data })
      expect(res.status(), `${m.method} ${m.url}`).toBe(403)
    }
  })
})

test.describe("administrateur", () => {
  test("chaque module s'ouvre depuis la navigation, entrée active signalée @mobile", async ({ page, isMobile }) => {
    await login(page, "admin", "/admin")
    for (const p of PAGES) {
      await page.goto(p.path)
      await expect(page.getByRole("heading", { level: 1, name: p.title })).toBeVisible()
      await expectNoHorizontalScroll(page)
      if (!isMobile) await expect(page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: p.title })).toHaveAttribute("aria-current", "page")
    }
  })

  test("un paramètre invalide est refusé par le serveur et le refus est journalisé", async ({ page }) => {
    await login(page, "admin", "/admin")
    const res = await page.request.patch("/api/admin/settings", { data: { key: "watch.maxFailures", value: 999 } })
    expect(res.status()).toBe(400)
    await page.goto("/admin/audit?target=watch.maxFailures&outcome=refused")
    const entry = page.locator("main ol > li").first()
    await expect(entry.getByText("Modification d'un paramètre")).toBeVisible()
    await expect(entry.getByText("Refusée")).toBeVisible()
  })

  test("les secrets de l'environnement ne sont jamais affichés", async ({ page }) => {
    await login(page, "admin", "/admin/settings")
    await expect(page.getByRole("heading", { name: /Déploiement/ })).toBeVisible()
    const html = await page.content()
    for (const name of ["AUTH_SECRET", "CRON_SECRET", "AUTH_GITHUB_SECRET", "AUTH_GOOGLE_SECRET", "AI_API_KEY"]) {
      const value = process.env[name]
      if (value && value.length >= 8) expect(html).not.toContain(value)
    }
  })
})
