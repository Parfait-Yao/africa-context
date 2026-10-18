import { expect, test } from "@playwright/test"
import { expectNoHorizontalScroll } from "./helpers"

test("accueil : preuve avant/après et commande d'installation @mobile", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Donnez")
  await expect(page.getByText("Sans contexte").first()).toBeVisible()
  await expect(page.getByText("npx africontext add wave-checkout-api").first()).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("recherche « paiement mobile » et « Sénégal » @mobile", async ({ page }) => {
  await page.goto("/contexts?q=paiement%20mobile")
  await expect(page.getByText(/contextes? pour/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Wave — API Checkout" })).toBeVisible()
  await page.goto("/contexts?q=S%C3%A9n%C3%A9gal")
  await expect(page.getByRole("link", { name: "Wave — API Checkout" })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("état vide avec appel à contribuer", async ({ page }) => {
  await page.goto("/contexts?q=zzzz-inexistant")
  await expect(page.getByText("Aucun contexte ne correspond")).toBeVisible()
  await expect(page.getByRole("link", { name: "Publier un contexte" }).last()).toBeVisible()
})

test("fiche : source, version, date, et copie comptée @mobile", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/contexts/wave-checkout-api")
  await expect(page.getByRole("heading", { level: 1, name: "Wave — API Checkout" })).toBeVisible()
  const meta = page.getByRole("complementary", { name: "Informations du contexte" })
  for (const label of ["Source officielle", "Version d'API", "Vérifié le"]) await expect(meta.locator("dt", { hasText: label })).toBeVisible()
  await page.getByRole("button", { name: "Copier le contexte" }).click()
  await expect(page.getByText("Contexte copié")).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("voter ou signaler sans être connecté mène à la connexion, avec retour sur la fiche", async ({ page }) => {
  await page.goto("/contexts/fedapay-transactions")
  await page.getByRole("button", { name: /votes positifs/ }).click()
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcontexts%2Ffedapay-transactions/)

  await page.goto("/contexts/fedapay-transactions")
  await page.getByRole("link", { name: "Se connecter pour signaler ce contexte" }).click()
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcontexts%2Ffedapay-transactions/)
})

test("un callbackUrl externe est ignoré après connexion", async ({ page }) => {
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/\\evil.example")}`)
  await page.getByLabel("Email").fill("dev@africontext.dev")
  await page.getByLabel("Mot de passe").fill("Dev-AfriContext-2026")
  await page.getByRole("button", { name: "Se connecter", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})

test("pages protégées redirigent vers la connexion", async ({ page }) => {
  await page.goto("/submit")
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsubmit/)
})
