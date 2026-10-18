import { describe, expect, it } from "vitest"
import { analyzeCodeBlocks, runContextChecks, summarizeChecks, type CheckableContext } from "@/modules/spec/context-checks"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

const body = REQUIRED_SECTIONS.map((s) =>
  s.key === "example"
    ? `## ${s.title}\n\`\`\`ts\nconst res = await fetch(process.env.API_URL!)\n\`\`\``
    : `## ${s.title}\nContenu suffisamment détaillé pour la section ${s.title}.`
).join("\n\n")

const base: CheckableContext = {
  slug: "testpay-checkout",
  title: "TestPay — paiement",
  description: "Contexte de test pour la validation technique côté administration.",
  type: "cursorrules",
  service: "TestPay",
  category: "paiement-mobile",
  countries: ["SN"],
  apiVersion: "v1",
  sourceUrl: "https://docs.testpay.example",
  testedWith: ["cursor"],
  tags: ["fintech"],
  content: body,
  sourceCheckedAt: "2026-10-01T00:00:00.000Z",
  sourceCheckFailures: 0,
  proofs: [],
}

const byKey = (c: CheckableContext) => Object.fromEntries(runContextChecks(c).map((x) => [x.key, x]))

describe("validation technique d'un contexte", () => {
  it("un contexte conforme ne remonte aucune erreur ni blocage", () => {
    const s = summarizeChecks(runContextChecks(base))
    expect(s).toMatchObject({ errors: 0, blocking: false })
  })

  it("section manquante et secret bloquent la publication", () => {
    const missing = byKey({ ...base, content: body.replace("## Webhooks", "## Autre") })
    expect(missing.sections).toMatchObject({ level: "error", blocking: true })
    const secret = byKey({ ...base, content: `${body}\nconst k = "sk_live_51HxYzAbCdEfGhIjKl"` })
    expect(secret.secrets.level).toBe("error")
    expect(summarizeChecks(runContextChecks({ ...base, content: `${body}\nsk_live_51HxYzAbCdEfGhIjKl` })).blocking).toBe(true)
  })

  it("le secret est masqué dans le rapport", () => {
    const secret = byKey({ ...base, content: `${body}\nsk_live_51HxYzAbCdEfGhIjKl` })
    expect(secret.secrets.details.join(" ")).not.toContain("sk_live_51HxYzAbCdEfGhIjKl")
  })

  it("contrôle les champs obligatoires de la Spec", () => {
    const r = byKey({ ...base, countries: [], sourceUrl: "http://docs.testpay.example" })
    expect(r.fields.level).toBe("error")
    expect(r.fields.details.join(" ")).toMatch(/Pays/)
    expect(r.source.level).toBe("error")
  })

  it("repère l'absence d'exemple, un bloc non refermé et un bloc sans langage", () => {
    expect(byKey({ ...base, content: body.replace(/```[\s\S]*?```/, "pas de code") }).code.level).toBe("error")
    expect(analyzeCodeBlocks("```ts\nx\n").unclosed).toBe(true)
    const noLang = byKey({ ...base, content: `${body}\n\`\`\`\ncode\n\`\`\`` })
    expect(noLang.code.level).toBe("warning")
  })

  it("signale une version d'API absente ou inhabituelle", () => {
    expect(byKey({ ...base, apiVersion: "" }).version.level).toBe("error")
    expect(byKey({ ...base, apiVersion: "dernière" }).version.level).toBe("warning")
    expect(byKey({ ...base, apiVersion: "2024-06-01" }).version.level).toBe("ok")
  })

  it("ne prétend jamais qu'un contexte sans preuve a été testé", () => {
    const r = byKey(base)
    expect(r.tests.level).toBe("info")
    expect(r.tests.details[0]).toMatch(/n'a pas été testé/)
    expect(r.tests.details[1]).toMatch(/non vérifiés/)
    expect(byKey({ ...base, proofs: [{ sandboxResult: "failed" }] }).tests.level).toBe("warning")
  })

  it("avertit quand la source est injoignable", () => {
    expect(byKey({ ...base, sourceCheckFailures: 2 }).source.level).toBe("warning")
  })
})
