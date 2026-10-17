import { describe, expect, it } from "vitest"
import { renderContext, targetFileName } from "@/modules/contexts/context.formats"
import { buildSearchText, normalize } from "@/modules/contexts/search-text"
import { mockContexts } from "@/data/mock-contexts"

const wave = mockContexts.find((c) => c.slug === "wave-checkout-api")!

describe("exports par outil", () => {
  it("raw : en-tête Spec puis corps", () => {
    const out = renderContext(wave, "raw")
    expect(out.startsWith("---\nslug: wave-checkout-api")).toBe(true)
    expect(out).toContain("source_url: https://docs.wave.com/checkout")
  })
  it("cursorrules : front matter Cursor", () => {
    const out = renderContext(wave, "cursorrules")
    expect(out).toMatch(/^---\ndescription: .+\nglobs:\nalwaysApply: false\n---/)
    expect(targetFileName("cursorrules", wave.slug)).toBe(".cursor/rules/wave-checkout-api.mdc")
  })
  it.each(["claude", "agents"] as const)("%s : bloc délimité réinstallable", (f) => {
    const out = renderContext(wave, f)
    expect(out.startsWith("<!-- africontext:wave-checkout-api:start -->")).toBe(true)
    expect(out.trimEnd().endsWith("<!-- africontext:wave-checkout-api:end -->")).toBe(true)
  })
})

describe("recherche normalisée", () => {
  it("supprime accents et casse", () => {
    expect(normalize("Sénégal  CÔTE d'Ivoire")).toBe("senegal cote d'ivoire")
  })
  it("indexe les noms de pays et la catégorie", () => {
    const t = buildSearchText(wave)
    expect(t).toContain("senegal")
    expect(t).toContain("paiement mobile")
  })
})

describe("données de démonstration", () => {
  it("chaque contexte publié respecte la Spec", async () => {
    const { validateSubmission } = await import("@/modules/spec/spec.schema")
    for (const c of mockContexts.filter((x) => x.status !== "pending")) {
      const r = validateSubmission({
        slug: c.slug, title: c.title, description: c.description, type: c.type, service: c.service, category: c.category,
        pays: c.countries, version_api: c.apiVersion, source_url: c.sourceUrl, tested_with: c.testedWith, tags: c.tags, content: c.content,
      })
      expect({ slug: c.slug, valid: r.valid, missing: r.missingSections, secrets: r.secrets, errors: r.fieldErrors }).toMatchObject({ valid: true })
    }
  })
})
