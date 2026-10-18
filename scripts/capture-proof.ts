/**
 * Capture une preuve avant / après (F9) : le même prompt est envoyé au modèle sans contexte,
 * puis avec le contexte AfriContext, et les deux sorties sont enregistrées sur la fiche.
 *
 *   npm run proof:capture -- <slug> "<prompt>" [--sandbox wave|orange|fedapay]
 *
 * Avec --sandbox, le code produit « avec contexte » est extrait et exécuté contre la sandbox ;
 * le résultat (passed / failed) est enregistré avec la preuve.
 * Nécessite AI_API_KEY (et AI_MODEL, facultatif) dans .env.
 */
import "dotenv/config"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { redactSecrets } from "../src/modules/spec/secret-scanner"

const [slug, prompt, ...rest] = process.argv.slice(2)
const sandboxIdx = rest.indexOf("--sandbox")
const scenario = sandboxIdx >= 0 ? rest[sandboxIdx + 1] : undefined
if (!slug || !prompt) {
  console.error('Usage : npm run proof:capture -- <slug> "<prompt>" [--sandbox wave|orange|fedapay]')
  process.exit(2)
}
if (!process.env.AI_API_KEY) {
  console.error("AI_API_KEY manquante dans .env.")
  process.exit(2)
}

const model = process.env.AI_MODEL ?? "claude-sonnet-5-5"
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function ask(system: string, user: string) {
  // API compatible OpenAI (Gemini, Groq, Ollama…) : voir src/lib/ai.ts
  if (process.env.AI_PROVIDER === "openai") {
    const res = await fetch(`${process.env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    })
    if (!res.ok) throw new Error(`API IA : HTTP ${res.status}`)
    const json = (await res.json()) as { choices: { message: { content: string | null } }[] }
    return json.choices[0]?.message.content ?? ""
  }
  const res = await fetch(`${process.env.AI_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": process.env.AI_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
  })
  if (!res.ok) throw new Error(`API IA : HTTP ${res.status}`)
  const json = (await res.json()) as { content: { type: string; text?: string }[] }
  return json.content.filter((b) => b.type === "text").map((b) => b.text).join("")
}

const extractCode = (s: string) => s.match(/```(?:ts|typescript|js|javascript)?\n([\s\S]*?)```/)?.[1] ?? s

async function main() {
  const ctx = await prisma.context.findUnique({ where: { slug } })
  if (!ctx) throw new Error(`Contexte inconnu : ${slug}`)
  const base = "Tu es un assistant de code. Réponds uniquement avec un module TypeScript qui exporte la fonction demandée, sans explication."
  console.log(`Modèle ${model} — sans contexte…`)
  const without = extractCode(await ask(base, prompt))
  console.log("… avec le contexte AfriContext")
  const withCtx = extractCode(await ask(`${base}\n\nContexte vérifié à respecter :\n${ctx.contentPayload}`, prompt))

  let sandboxResult: "passed" | "failed" | undefined
  let sandboxReport: { scenario: string; checks: { name: string; ok: boolean; detail?: string }[] } | undefined
  if (scenario) {
    const dir = mkdtempSync(join(tmpdir(), "ac-proof-"))
    const file = join(dir, "generated.ts")
    writeFileSync(file, withCtx)
    // Sortie JSON du runner : les vérifications détaillées sont conservées avec la preuve
    let out = ""
    try {
      out = execFileSync(process.execPath, ["sandbox/run.mjs", file, "--scenario", scenario, "--json"], { encoding: "utf8" })
      sandboxResult = "passed"
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? "")
      sandboxResult = "failed"
    }
    try {
      const report = JSON.parse(out) as { checks?: { name: string; ok: boolean; detail?: string }[] }
      sandboxReport = {
        scenario,
        checks: (report.checks ?? []).slice(0, 30).map((c) => ({ name: String(c.name), ok: Boolean(c.ok), detail: c.detail ? redactSecrets(String(c.detail)).slice(0, 300) : undefined })),
      }
    } catch {
      sandboxReport = { scenario, checks: [{ name: "Exécution", ok: false, detail: "Rapport du runner illisible." }] }
    }
    for (const c of sandboxReport.checks) console.log(`  ${c.ok ? "✔" : "✖"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`)
  }
  const proof = await prisma.proof.create({
    data: { contextId: ctx.id, prompt, outputWithoutContext: without, outputWithContext: withCtx, model, sandboxResult, sandboxReport, apiVersion: ctx.apiVersion },
  })
  console.log(`✔ Preuve ${proof.id} enregistrée sur ${slug}${sandboxResult ? ` (sandbox : ${sandboxResult})` : ""}`)
}

main()
  .catch((e) => {
    console.error("✖", e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
