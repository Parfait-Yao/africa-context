import { describe, expect, it } from "vitest"
import { REQUIRED_SECTIONS, SPEC_BODY_TEMPLATE, checkSections, validateSubmission } from "@/modules/spec/spec.schema"
import { parseSpecMarkdown } from "@/modules/spec/spec.parser"

const content = REQUIRED_SECTIONS.map((s) => `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`).join("\n\n")
const valid = {
  slug: "wave-checkout-api",
  title: "Wave — API Checkout",
  description: "Créer une session de paiement Wave et confirmer par webhook.",
  type: "cursorrules",
  service: "Wave",
  category: "paiement-mobile",
  pays: ["SN", "CI"],
  version_api: "v1",
  source_url: "https://docs.wave.com/checkout",
  tested_with: ["cursor"],
  tags: ["fintech"],
  content,
}

describe("checkSections", () => {
  it("trouve les 8 sections du gabarit", () => {
    expect(checkSections(SPEC_BODY_TEMPLATE).missing).toEqual([])
  })
  it("liste les sections manquantes", () => {
    const { missing } = checkSections("## Authentification\n\n## Erreurs")
    expect(missing.map((m) => m.key)).toContain("webhooks")
    expect(missing).toHaveLength(6)
  })
  it("ignore les accents et la casse", () => {
    expect(checkSections("## PIEGES COURANTS").present).toContain("pitfalls")
  })
})

describe("validateSubmission", () => {
  it("accepte une soumission conforme", () => {
    expect(validateSubmission(valid).valid).toBe(true)
  })
  it("refuse une source non HTTPS", () => {
    const r = validateSubmission({ ...valid, source_url: "http://docs.wave.com" })
    expect(r.valid).toBe(false)
    expect(r.fieldErrors.source_url?.[0]).toMatch(/HTTPS/)
  })
  it("refuse un type inconnu et un slug invalide", () => {
    const r = validateSubmission({ ...valid, type: "prompt", slug: "Wave Checkout" })
    expect(r.fieldErrors.type).toBeDefined()
    expect(r.fieldErrors.slug).toBeDefined()
  })
  it("refuse un contenu avec secret, même ailleurs que dans le corps", () => {
    const r = validateSubmission({ ...valid, description: "Clé de test sk_live_51HxYzAbCdEfGhIjKl incluse." })
    expect(r.valid).toBe(false)
    expect(r.secrets.length).toBeGreaterThan(0)
  })
  it("refuse une section manquante", () => {
    const r = validateSubmission({ ...valid, content: content.replace("## Webhooks", "## Divers") })
    expect(r.missingSections.map((s) => s.key)).toEqual(["webhooks"])
  })
})

describe("parseSpecMarkdown", () => {
  it("lit l'en-tête YAML et le corps", () => {
    const md = `---\nslug: wave-checkout-api\ntitle: Wave - API Checkout\ntype: cursorrules\nservice: Wave\npays: [SN, CI]\nversion_api: v1\nsource_url: https://docs.wave.com\ntested_with: [cursor, claude-code]\ntags: [fintech, paiement-mobile]\n---\n\n## Authentification\nTexte`
    const p = parseSpecMarkdown(md)
    expect(p.slug).toBe("wave-checkout-api")
    expect(p.pays).toEqual(["SN", "CI"])
    expect(p.tested_with).toEqual(["cursor", "claude-code"])
    expect(p.content.startsWith("## Authentification")).toBe(true)
  })
  it("accepte un fichier sans en-tête", () => {
    expect(parseSpecMarkdown("## Authentification").content).toBe("## Authentification")
  })
})
