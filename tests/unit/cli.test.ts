import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createServer, type Server } from "node:http"
import { execFile } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { buildInstallPlan, type InstallEnv, type Stack } from "@/modules/contexts/install-plan"
import type { Context } from "@/modules/contexts/context.types"

const CLI = resolve("packages/cli/src/index.ts")
// Point d'entrée JS de tsx lancé par node : marche aussi sous Windows (pas de .cmd à résoudre)
const TSX = resolve("node_modules/tsx/dist/cli.mjs")
let server: Server
let api = ""
let version = 1
const requests: string[] = []

const context = (slug: string): Context =>
  ({
    slug,
    title: `Service ${slug}`,
    description: "Contexte de test.",
    service: "TestPay",
    apiVersion: "v1",
    sourceUrl: "https://docs.testpay.example",
    status: "approved",
    lastVerifiedAt: "2026-10-14T00:00:00.000Z",
    content: `## Authentification\nRègles v${version}\n\n## Variables d'environnement\n- \`TESTPAY_API_KEY\` — clé secrète\n- \`APP_URL\``,
  }) as Context

beforeAll(async () => {
  // Faux serveur : sert de vrais plans (même code que l'API), plus un plan malveillant pour tester les garde-fous
  server = createServer((req, res) => {
    requests.push(req.url!)
    const url = new URL(req.url!, "http://x")
    const m = url.pathname.match(/^\/api\/contexts\/([\w-]+)\/install$/)
    if (!m || m[1] === "absent") return res.writeHead(404).end("{}")
    const plan = buildInstallPlan(context(m[1]), url.searchParams.get("env") as InstallEnv, url.searchParams.get("stack") as Stack)
    if (m[1] === "malicious") plan.files = [{ kind: "file", path: "../evil.txt", content: "pwned" }]
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: plan }))
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()))
  api = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => server.close())

function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((done) => {
    const child = execFile(process.execPath, [TSX, CLI, ...args, "--api", api], { cwd, encoding: "utf8" }, (err, stdout, stderr) => {
      done({ code: err ? (child.exitCode ?? 1) : 0, out: stdout + stderr })
    })
    child.stdin?.end()
  })
}

const project = (pkg?: object) => {
  const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
  if (pkg) writeFileSync(join(dir, "package.json"), JSON.stringify(pkg))
  return dir
}
const read = (dir: string, f: string) => readFileSync(join(dir, f), "utf8")

describe("CLI africontext add", () => {
  it("projet Next.js + Cursor : règles adaptées, variables vides dans .env.local et .env.example, .env.local ignoré", async () => {
    const dir = project({ dependencies: { next: "16.0.0" } })
    writeFileSync(join(dir, ".gitignore"), "node_modules\n")
    const r = await run(dir, "add", "orange-money-webpay", "--env", "cursor")
    expect(r.code).toBe(0)
    expect(requests.at(-1)).toContain("env=cursor&stack=next")

    const rule = read(dir, ".cursor/rules/orange-money-webpay.mdc")
    expect(rule).toContain("alwaysApply: true")
    expect(rule).toContain("Projet détecté : **Next.js**")
    expect(rule).toContain("Règles v1")
    expect(read(dir, ".env.local")).toMatch(/# clé secrète\nTESTPAY_API_KEY=\nAPP_URL=\n$/)
    expect(read(dir, ".env.example")).toContain("TESTPAY_API_KEY=")
    expect(read(dir, ".gitignore")).toBe("node_modules\n.env.local\n")
    expect(r.out).toContain("Renseignez vos clés")
    expect(r.out).toContain("Demandez à votre agent")
  })

  it("relancer met à jour les règles sans dupliquer ni toucher aux valeurs déjà saisies", async () => {
    const dir = project({ dependencies: { express: "5.0.0" } })
    writeFileSync(join(dir, ".env"), "APP_URL=https://boutique.example\n")
    writeFileSync(join(dir, ".gitignore"), ".env*\n")
    await run(dir, "add", "wave-checkout-api", "--env", "cursor")
    writeFileSync(join(dir, ".env"), read(dir, ".env").replace("TESTPAY_API_KEY=", "TESTPAY_API_KEY=ma-valeur"))
    version = 2
    const r = await run(dir, "add", "wave-checkout-api", "--env", "cursor")
    version = 1
    expect(r.code).toBe(0)
    expect(read(dir, ".cursor/rules/wave-checkout-api.mdc")).toContain("Règles v2")
    const env = read(dir, ".env")
    expect(env.match(/TESTPAY_API_KEY=/g)).toHaveLength(1)
    expect(env).toContain("TESTPAY_API_KEY=ma-valeur")
    expect(env.match(/APP_URL=/g)).toHaveLength(1)
    expect(read(dir, ".gitignore")).toBe(".env*\n") // déjà couvert par le motif
  })

  it("Claude Code : bloc ajouté puis mis à jour dans CLAUDE.md, le reste du fichier intact", async () => {
    const dir = project()
    writeFileSync(join(dir, "CLAUDE.md"), "# Mon projet\nRègles maison\n")
    await run(dir, "add", "wave-checkout-api", "--env", "claude")
    version = 3
    await run(dir, "add", "wave-checkout-api", "--env", "claude")
    version = 1
    const md = read(dir, "CLAUDE.md")
    expect(md.startsWith("# Mon projet\nRègles maison\n")).toBe(true)
    expect(md.match(/africontext:wave-checkout-api:start/g)).toHaveLength(1)
    expect(md).toContain("Règles v3")
  })

  it("détecte l'outil déjà présent ; l'ancienne option --format reste acceptée", async () => {
    const dir = project()
    writeFileSync(join(dir, "CLAUDE.md"), "# Projet\n")
    const r = await run(dir, "add", "wave-checkout-api")
    expect(r.out).toContain("Environnement détecté : Claude Code")
    expect(read(dir, "CLAUDE.md")).toContain("africontext:wave-checkout-api:start")

    const legacy = project()
    await run(legacy, "add", "wave-checkout-api", "--format", "agents")
    expect(read(legacy, "AGENTS.md")).toContain("africontext:wave-checkout-api:start")
  })

  it("n'écrase pas un fichier qui n'appartient pas à AfriContext sans --force", async () => {
    const dir = project()
    mkdirSync(join(dir, ".github/instructions"), { recursive: true })
    writeFileSync(join(dir, ".github/instructions/wave-checkout-api.instructions.md"), "mes consignes\n")
    const r = await run(dir, "add", "wave-checkout-api", "--env", "copilot")
    expect(r.out).toContain("conservé")
    expect(read(dir, ".github/instructions/wave-checkout-api.instructions.md")).toBe("mes consignes\n")
    await run(dir, "add", "wave-checkout-api", "--env", "copilot", "--force")
    expect(read(dir, ".github/instructions/wave-checkout-api.instructions.md")).toContain('applyTo: "**"')
  })

  it("Windsurf : règle courte toujours active + contexte complet à côté", async () => {
    const dir = project()
    await run(dir, "add", "wave-checkout-api", "--env", "windsurf")
    expect(read(dir, ".windsurf/rules/wave-checkout-api.md")).toContain("trigger: always_on")
    expect(read(dir, "africontext/wave-checkout-api.md")).toContain("Règles v1")
  })

  it("--dry-run n'écrit rien ; list retrouve les contextes installés", async () => {
    const dir = project()
    await run(dir, "add", "wave-checkout-api", "--env", "cursor", "--dry-run")
    expect(existsSync(join(dir, ".cursor"))).toBe(false)
    expect(existsSync(join(dir, ".env"))).toBe(false)
    await run(dir, "add", "wave-checkout-api", "--env", "cursor")
    await run(dir, "add", "africastalking-sms", "--env", "agents")
    await run(dir, "add", "orange-money-webpay", "--env", "copilot")
    const out = (await run(dir, "list")).out
    expect(out).toContain("wave-checkout-api")
    expect(out).toContain("africastalking-sms")
    expect(out).toContain("orange-money-webpay")
  })

  it("échoue proprement : slug invalide, contexte absent, environnement inconnu, chemin hors du projet", async () => {
    const dir = project()
    expect((await run(dir, "add", "../../etc")).code).toBe(1)
    const absent = await run(dir, "add", "absent", "--env", "cursor")
    expect(absent.code).toBe(1)
    expect(absent.out).toContain("Aucun contexte publié")
    expect((await run(dir, "add", "wave-checkout-api", "--env", "vim")).code).toBe(1)
    const evil = await run(dir, "add", "malicious", "--env", "cursor")
    expect(evil.code).toBe(1)
    expect(evil.out).toContain("Chemin refusé")
    expect(existsSync(join(dir, "..", "evil.txt"))).toBe(false)
  })
})
