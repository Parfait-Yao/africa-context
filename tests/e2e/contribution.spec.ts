import { expect, test } from "@playwright/test"
import { login } from "./helpers"

const slug = `e2e-test-${Date.now().toString(36)}`

test.describe.serial("contribution → modération → publication", () => {
  test("une fausse clé d'API bloque la soumission", async ({ page }) => {
    await login(page, "dev", "/submit")
    await page.getByLabel("Titre").fill("Test E2E — paiement")
    await page.getByLabel("Slug").fill(slug)
    await page.getByLabel("Service").fill("TestPay")
    await page.getByLabel("Description courte").fill("Contexte créé par le test de bout en bout. Clé : sk_live_51HxYzAbCdEfGhIjKl")
    await expect(page.getByText(/secrets? détectés?/)).toBeVisible()
    await page.getByRole("button", { name: "Relire avant de publier" }).click()
    await expect(page.getByText("Retirez le secret détecté avant de publier.")).toBeVisible()
  })

  test("une soumission valide passe en attente", async ({ page }) => {
    await login(page, "dev", "/submit")
    await page.getByLabel("Titre").fill("Test E2E — paiement")
    await page.getByLabel("Slug").fill(slug)
    await page.getByLabel("Service").fill("TestPay")
    await page.getByLabel("Description courte").fill("Contexte créé par le test de bout en bout d'AfriContext.")
    await page.getByLabel("URL de la documentation officielle").fill("https://docs.testpay.example")
    await page.getByLabel("Catégorie").selectOption("paiement-mobile")
    await page.getByText("Sénégal", { exact: true }).click()
    await expect(page.getByText("8/8")).toBeVisible()
    // Étape de relecture avant l'envoi (ajoutée avec l'espace d'administration)
    await page.getByRole("button", { name: "Relire avant de publier" }).click()
    await page.getByRole("button", { name: "Confirmer et publier" }).click()
    await expect(page.getByRole("heading", { name: "Contexte soumis, en attente de validation" })).toBeVisible()
    const res = await page.request.get(`/api/contexts/${slug}`)
    expect(res.status()).toBe(200) // visible par son auteur
  })

  test("l'administrateur approuve, le contexte apparaît dans le catalogue", async ({ page, browser }) => {
    const anon = await browser.newContext()
    expect((await anon.request.get(`/api/contexts/${slug}`)).status()).toBe(404)

    await login(page, "admin", "/admin/moderation")
    const row = page.getByRole("row", { name: /Test E2E — paiement/ })
    await row.getByRole("button", { name: "Relire" }).click()
    await expect(page.getByText("Aucun secret détecté")).toBeVisible()
    await page.getByRole("button", { name: "Approuver et publier" }).click()
    await expect(page.getByText("Contexte approuvé et publié")).toBeVisible()

    expect((await anon.request.get(`/api/contexts/${slug}`)).status()).toBe(200)
    const anonPage = await anon.newPage()
    await anonPage.goto("/contexts?q=testpay")
    // Le titre n'est pas unique (exécutions précédentes) : on cible le lien de ce contexte
    await expect(anonPage.locator(`a[href="/contexts/${slug}"]`).first()).toBeVisible()
    await anon.close()
  })

  test("un développeur ne peut pas ouvrir la modération", async ({ page }) => {
    await login(page, "dev")
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
