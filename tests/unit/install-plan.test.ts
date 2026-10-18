import { describe, expect, it } from "vitest"
import { buildInstallPlan, extractEnvVars, INSTALL_ENV_KEYS, ruleFilePaths } from "@/modules/contexts/install-plan"
import type { Context } from "@/modules/contexts/context.types"

export const fixture = (over: Partial<Context> = {}): Context =>
  ({
    id: "c1",
    slug: "orange-money-webpay",
    title: "Orange Money — Web Payment",
    description: 'Initier un paiement Web Payment "Orange Money".',
    type: "claude_prompt",
    service: "Orange Money",
    category: "paiement-mobile",
    countries: ["CI"],
    apiVersion: "v1",
    sourceUrl: "https://developer.orange.com/apis/om-webpay",
    testedWith: [],
    tags: [],
    status: "approved",
    lastVerifiedAt: "2026-10-13T11:00:00.000Z",
    content: [
      "## Authentification\nOAuth `client_credentials` avec `Basic $OM_AUTH_HEADER`.",
      "## Exemple minimal complet\n```ts\nexport const ok = true\n```",
      "## Variables d'environnement\n- `OM_AUTH_HEADER` — en-tête Basic fourni par Orange\n- `OM_MERCHANT_KEY`\n- `APP_URL`\n- pas une variable",
    ].join("\n\n"),
    ...over,
  }) as Context

describe("extractEnvVars", () => {
  it("lit la section de la Spec, avec description éventuelle, sans doublon", () => {
    expect(extractEnvVars(fixture().content)).toEqual([
      { name: "OM_AUTH_HEADER", description: "en-tête Basic fourni par Orange" },
      { name: "OM_MERCHANT_KEY", description: undefined },
      { name: "APP_URL", description: undefined },
    ])
    expect(extractEnvVars("## Authentification\n- `NOT_IN_SECTION`")).toEqual([])
  })
})

describe("buildInstallPlan", () => {
  it("chaque environnement écrit ses règles aux chemins annoncés sur le site", () => {
    for (const env of INSTALL_ENV_KEYS) {
      const plan = buildInstallPlan(fixture(), env, "next")
      const paths = plan.files.filter((f) => f.kind === "file" || f.kind === "block").map((f) => f.path)
      expect(paths.sort()).toEqual(ruleFilePaths(env, "orange-money-webpay").sort())
    }
  })

  it("Next.js : consignes serveur, variables dans .env.local, .env.local ignoré par git", () => {
    const plan = buildInstallPlan(fixture(), "cursor", "next")
    expect(plan.envFile).toBe(".env.local")
    const rule = plan.files[0]
    expect(rule.kind).toBe("file")
    const content = (rule as { content: string }).content
    expect(content).toMatch(/^---\ndescription: "Initier un paiement Web Payment 'Orange Money'."\nglobs:\nalwaysApply: true\n---/)
    expect(content).toContain("Projet détecté : **Next.js**")
    expect(content).toContain("NEXT_PUBLIC_")
    expect(content).toContain("`OM_AUTH_HEADER`, `OM_MERCHANT_KEY`, `APP_URL`")
    expect(content).toContain("## Exemple minimal complet")
    expect(plan.files.filter((f) => f.kind === "env").map((f) => f.path)).toEqual([".env.example", ".env.local"])
    expect(plan.files.at(-1)).toEqual({ kind: "lines", path: ".gitignore", lines: [".env.local"] })
  })

  it("front-end Vite : avertit que les clés ne doivent pas aller dans le navigateur", () => {
    const plan = buildInstallPlan(fixture(), "claude", "vite")
    expect(plan.warnings.join(" ")).toContain("front-end")
    const block = plan.files[0] as { content: string; start: string; end: string }
    expect(block.content.startsWith(block.start)).toBe(true)
    expect(block.content.trimEnd().endsWith(block.end)).toBe(true)
    expect(block.content).toContain("n'appelle JAMAIS cette API depuis le front")
  })

  it("contexte à revérifier : avertissement dans le plan et dans les règles ; sans variables, pas de fichier .env", () => {
    const plan = buildInstallPlan(fixture({ status: "to_recheck", content: "## Authentification\nAucune clé." }), "agents", "unknown")
    expect(plan.warnings[0]).toContain("à revérifier")
    expect((plan.files[0] as { content: string }).content).toContain("⚠️")
    expect(plan.files.some((f) => f.kind === "env")).toBe(false)
    expect(plan.envFile).toBe(".env")
  })
})
