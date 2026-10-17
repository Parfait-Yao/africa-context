/**
 * Chargé avant le code testé (--import) : redirige les appels vers les vraies API
 * africaines sur la sandbox et bloque tout autre accès réseau sortant.
 */
const SANDBOX = process.env.AFRICONTEXT_SANDBOX_URL ?? "http://localhost:4010"
const MAP = {
  "api.wave.com": "/wave",
  "api.orange.com": "/orange",
  "api.fedapay.com": "/fedapay",
  "sandbox-api.fedapay.com": "/fedapay",
}
const realFetch = globalThis.fetch
globalThis.__sandboxCalls = []

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
  const prefix = MAP[url.hostname]
  const sandboxHost = new URL(SANDBOX).host
  if (!prefix && url.host !== sandboxHost) {
    throw new Error(`Réseau bloqué par la sandbox : ${url.hostname} n'est pas une API simulée.`)
  }
  const target = prefix ? `${SANDBOX}${prefix}${url.pathname}${url.search}` : url.toString()
  globalThis.__sandboxCalls.push({ method: init?.method ?? "GET", original: url.toString(), target })
  return realFetch(target, init)
}

// Le code testé ne doit pas lancer de processus : on neutralise child_process (CJS et ESM).
import { createRequire, syncBuiltinESMExports } from "node:module"
const cp = createRequire(import.meta.url)("node:child_process")
for (const fn of ["exec", "execSync", "spawn", "spawnSync", "fork", "execFile", "execFileSync"]) {
  cp[fn] = () => {
    throw new Error("Processus enfants interdits dans la sandbox.")
  }
}
syncBuiltinESMExports()
