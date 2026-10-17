#!/usr/bin/env node
/**
 * Exécute du code généré par une IA contre la sandbox, dans un processus isolé.
 *   node sandbox/run.mjs <fichier.ts|.js> --scenario wave|orange|fedapay [--sandbox http://localhost:4010] [--json]
 * Limites : 128 Mo de mémoire, 15 s, aucun accès réseau hors sandbox, environnement vidé
 * (seules des clés de test factices sont fournies).
 */
import { spawn } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { existsSync } from "node:fs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true)
const scenario = flag("scenario", "wave")
const sandbox = flag("sandbox", process.env.SANDBOX_URL ?? "http://localhost:4010")
const asJson = args.includes("--json")

if (!file || !existsSync(file)) {
  console.error("Usage : node sandbox/run.mjs <fichier> --scenario wave|orange|fedapay")
  process.exit(2)
}

const env = {
  PATH: process.env.PATH,
  AFRICONTEXT_SANDBOX_URL: sandbox,
  APP_URL: "https://boutique.example",
  WAVE_API_KEY: "wave_sn_prod_SANDBOX_KEY_0000",
  WAVE_WEBHOOK_SECRET: "wave_sandbox_webhook_secret",
  OM_AUTH_HEADER: "U0FOREJPWDpTQU5EQk9Y",
  OM_MERCHANT_KEY: "sandbox-merchant",
  OM_COUNTRY: "dev",
  FEDAPAY_SECRET_KEY: "sk_sandbox_SANDBOX_KEY_0000",
  FEDAPAY_ENV: "sandbox",
}

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings", "--max-old-space-size=128", "--import", pathToFileURL(resolve(here, "preload.mjs")).href, resolve(here, "harness.mjs"), resolve(file), scenario],
  { env, stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 }
)
let out = ""
let err = ""
child.stdout.on("data", (d) => (out += d))
child.stderr.on("data", (d) => (err += d))
child.on("close", (code, signal) => {
  let report
  try {
    report = JSON.parse(out.trim().split("\n").at(-1))
  } catch {
    report = { scenario, file, passed: false, checks: [{ name: "Exécution", ok: false, detail: signal ? `arrêté (${signal}) : délai ou mémoire dépassés` : err.trim().split("\n").slice(-3).join(" ") || `code ${code}` }] }
  }
  if (asJson) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`\nSandbox ${scenario} — ${file}\n`)
    for (const c of report.checks) console.log(`  ${c.ok ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} ${c.name}${c.detail ? `\x1b[2m — ${c.detail}\x1b[0m` : ""}`)
    console.log(`\n  ${report.passed ? "\x1b[32mTEST RÉUSSI\x1b[0m" : "\x1b[31mTEST ÉCHOUÉ\x1b[0m"}\n`)
  }
  process.exit(report.passed ? 0 : 1)
})
