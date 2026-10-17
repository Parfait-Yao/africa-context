import { describe, expect, it } from "vitest"
import { scanForSecrets } from "@/modules/spec/secret-scanner"

describe("scanForSecrets", () => {
  it.each([
    ["clé sk_live", 'const k = "sk_live_51HxYzAbCdEfGh"'],
    ["clé Wave", "WAVE_API_KEY=wave_sn_prod_AbCdEf123456789"],
    ["Bearer en clair", "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6"],
    ["Basic Orange en clair", "Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQxMjM0NTY3OA=="],
    ["clé AWS", "AKIAIOSFODNN7EXAMPLE"],
    ["jeton GitHub", "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"],
    ["clé privée", "-----BEGIN RSA PRIVATE KEY-----"],
    ["affectation", 'api_key: "abcdef1234567890xyz"'],
    ["Flutterwave", "FLWSECK_TEST-abcdefghijklmnopqrstuvwx-X"],
  ])("détecte : %s", (_label, text) => {
    expect(scanForSecrets(text).length).toBeGreaterThan(0)
  })

  it.each([
    ["variable d'environnement", "Authorization: Bearer $WAVE_API_KEY"],
    ["template", "Authorization: `Bearer ${process.env.WAVE_API_KEY}`"],
    ["placeholder", 'api_key: "VOTRE_CLE_ICI_123456"'],
    ["nom seul", "- `WAVE_API_KEY`"],
    ["Basic variable", "Authorization: Basic $OM_AUTH_HEADER"],
  ])("ne signale pas : %s", (_label, text) => {
    expect(scanForSecrets(text)).toEqual([])
  })

  it("masque la valeur et donne la ligne", () => {
    const [f] = scanForSecrets("ligne 1\nconst k = 'sk_live_51HxYzAbCdEfGhIjKl'")
    expect(f.line).toBe(2)
    expect(f.excerpt).not.toContain("51HxYz")
  })
})
