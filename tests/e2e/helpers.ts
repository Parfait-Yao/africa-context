import { expect, type Page } from "@playwright/test"

export const ACCOUNTS = {
  admin: { email: "admin@africontext.dev", password: "Admin-AfriContext-2026" },
  dev: { email: "dev@africontext.dev", password: "Dev-AfriContext-2026" },
}

export async function login(page: Page, who: keyof typeof ACCOUNTS, callbackUrl = "/dashboard") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  await page.getByLabel("Email").fill(ACCOUNTS[who].email)
  await page.getByLabel("Mot de passe").fill(ACCOUNTS[who].password)
  await page.getByRole("button", { name: "Se connecter", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(callbackUrl.replace(/[?]/g, "\\?")))
}

/** Aucune page ne doit défiler horizontalement. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}
