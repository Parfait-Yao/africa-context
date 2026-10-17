import { defineConfig, devices } from "@playwright/test"

/**
 * Parcours de recette dans un vrai navigateur (desktop 1366 px + mobile 390 px).
 * Prérequis : base migrée + seed, `npm run build`. Le serveur est lancé automatiquement
 * (ou réutilisé s'il tourne déjà). Première fois : `npx playwright install chromium`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "fr-FR" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 120_000 },
})
