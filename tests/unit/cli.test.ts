import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createServer, type Server } from "node:http"
import { execFile } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const CLI = resolve("packages/cli/src/index.ts")
// Point d'entrée JS de tsx lancé par node : marche aussi sous Windows (pas de .cmd à résoudre)
const TSX = resolve("node_modules/tsx/dist/cli.mjs")
let server: Server
let api = ""
let version = 1

beforeAll(async () => {
  server = createServer((req, res) => {
    const m = req.url!.match(/^\/api\/contexts\/([\w-]+)\/raw\?format=(\w+)/)
    if (!m || m[1] === "absent") return res.writeHead(404).end("introuvable")
    const [, slug, format] = m
    const target = format === "claude" ? "CLAUDE.md" : format === "agents" ? "AGENTS.md" : `.cursor/rules/${slug}.mdc`
    const body = format === "claude" || format === "agents" ? `<!-- africontext:${slug}:start -->\nv${version}\n<!-- africontext:${slug}:end -->\n` : `regle v${version}\nContexte AfriContext\n`
    res.writeHead(200, { "x-africontext-target": target, "x-africontext-verified-at": "2026-10-14T00:00:00Z", "x-africontext-status": "approved" }).end(body)
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

describe("CLI africontext", async () => {
  it("écrit une règle Cursor au bon endroit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
    expect((await run(dir, "add", "wave-checkout-api")).code).toBe(0)
    expect(readFileSync(join(dir, ".cursor/rules/wave-checkout-api.mdc"), "utf8")).toContain("regle v1")
  })

  it("n'écrase pas un fichier existant sans --force", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
    await run(dir, "add", "wave-checkout-api")
    version = 2
    const r = await run(dir, "add", "wave-checkout-api")
    expect(r.out).toContain("conservé")
    expect(readFileSync(join(dir, ".cursor/rules/wave-checkout-api.mdc"), "utf8")).toContain("v1")
    await run(dir, "add", "wave-checkout-api", "--force")
    expect(readFileSync(join(dir, ".cursor/rules/wave-checkout-api.mdc"), "utf8")).toContain("v2")
    version = 1
  })

  it("ajoute puis met à jour son bloc dans CLAUDE.md sans toucher au reste", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
    writeFileSync(join(dir, "CLAUDE.md"), "# Mon projet\nRègles maison\n")
    await run(dir, "add", "wave-checkout-api", "--format", "claude")
    version = 3
    await run(dir, "add", "wave-checkout-api", "--format", "claude")
    version = 1
    const md = readFileSync(join(dir, "CLAUDE.md"), "utf8")
    expect(md).toContain("Règles maison")
    expect(md.match(/africontext:wave-checkout-api:start/g)).toHaveLength(1)
    expect(md).toContain("v3")
  })

  it("--dry-run n'écrit rien, list retrouve les contextes installés", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
    await run(dir, "add", "wave-checkout-api", "--dry-run")
    expect(existsSync(join(dir, ".cursor"))).toBe(false)
    await run(dir, "add", "wave-checkout-api")
    await run(dir, "add", "africastalking-sms", "--format", "agents")
    const out = (await run(dir, "list")).out
    expect(out).toContain("wave-checkout-api")
    expect(out).toContain("africastalking-sms")
  })

  it("échoue proprement : slug invalide, contexte absent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-cli-"))
    expect((await run(dir, "add", "../../etc")).code).toBe(1)
    const absent = await run(dir, "add", "absent")
    expect(absent.code).toBe(1)
    expect(absent.out).toContain("Aucun contexte publié")
  })
})
