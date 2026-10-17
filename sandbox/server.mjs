#!/usr/bin/env node
/**
 * AfriContext Sandbox (F10) — faux serveurs Wave, Orange Money et FedaPay.
 * Aucune dépendance : `node sandbox/server.mjs` (port 4010 par défaut).
 *
 * Les mocks valident strictement les requêtes comme les vraies API (en-têtes,
 * types de champs, devises, idempotence, quotas) et envoient des webhooks signés.
 * Routes de pilotage : /__sandbox/* (journal des requêtes, déclenchement des paiements,
 * pages de documentation modifiables pour tester la veille).
 */
import { createServer } from "node:http"
import { createHmac, randomBytes } from "node:crypto"

const PORT = Number(process.env.PORT ?? 4010)
const PUBLIC_URL = process.env.SANDBOX_PUBLIC_URL ?? `http://localhost:${PORT}`
export const WAVE_WEBHOOK_SECRET = process.env.SANDBOX_WAVE_WEBHOOK_SECRET ?? "wave_sandbox_webhook_secret"

const log = []
const waveSessions = new Map()
const omTokens = new Set()
const omPayments = new Map()
const fedaTx = new Map()
const hits = new Map()
const docs = new Map([
  ["wave-checkout", "<h1>Wave Checkout API</h1><p>POST /v1/checkout/sessions — amount (string), currency XOF.</p>"],
])

const id = (p) => `${p}-${randomBytes(6).toString("hex")}`

function send(res, status, body, headers = {}) {
  const isText = typeof body === "string"
  res.writeHead(status, { "Content-Type": isText ? "text/html; charset=utf-8" : "application/json", ...headers })
  res.end(isText ? body : JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > 1_000_000) throw new Error("payload too large")
    chunks.push(c)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function parseBody(raw, type = "") {
  if (!raw) return {}
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw))
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function rateLimited(key, limit = 30, windowMs = 10_000) {
  const now = Date.now()
  const e = hits.get(key)
  if (!e || e.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    return false
  }
  e.n++
  return e.n > limit
}

const isHttps = (v) => typeof v === "string" && /^https:\/\/[^\s]+$/.test(v)

async function postWebhook(url, payload, headers = {}) {
  const body = JSON.stringify(payload)
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body })
    return { delivered: r.ok, status: r.status }
  } catch (e) {
    return { delivered: false, error: String(e.message ?? e) }
  }
}

/** Signature Wave : en-tête `Wave-Signature: t=<timestamp>,v1=<hmac>` avec HMAC-SHA256(secret, timestamp + corps). */
export function signWave(body, secret = WAVE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}${body}`).digest("hex")
  return `t=${t},v1=${v1}`
}

// ----------------------------------------------------------------- Wave
async function wave(req, res, path, body) {
  const auth = req.headers.authorization ?? ""
  if (!/^Bearer\s+\S{8,}$/.test(auth) || /undefined|null/.test(auth)) {
    return send(res, 401, { code: "missing-auth-header", message: "Authorization: Bearer <WAVE_API_KEY> est requis." })
  }
  if (rateLimited(`wave:${auth}`)) return send(res, 429, { code: "rate-limit-exceeded", message: "Trop de requêtes." }, { "Retry-After": "10" })

  if (req.method === "POST" && path === "/v1/checkout/sessions") {
    if (!(req.headers["content-type"] ?? "").includes("application/json")) return send(res, 415, { code: "unsupported-media-type", message: "Content-Type: application/json attendu." })
    if (body === undefined) return send(res, 400, { code: "request-validation-error", message: "Corps JSON invalide." })
    const details = []
    if (typeof body.amount !== "string") details.push({ loc: ["amount"], msg: "amount doit être une chaîne (ex. \"5000\")." })
    else if (!/^\d+$/.test(body.amount)) details.push({ loc: ["amount"], msg: "XOF n'a pas de décimales : entier positif attendu." })
    if (body.currency !== "XOF") details.push({ loc: ["currency"], msg: `Devise inconnue « ${body.currency} » : utiliser XOF.` })
    if (!isHttps(body.success_url)) details.push({ loc: ["success_url"], msg: "success_url doit être une URL complète en https." })
    if (!isHttps(body.error_url)) details.push({ loc: ["error_url"], msg: "error_url doit être une URL complète en https." })
    if (body.client_reference && String(body.client_reference).length > 255) details.push({ loc: ["client_reference"], msg: "255 caractères maximum." })
    const unknown = Object.keys(body).filter((k) => !["amount", "currency", "success_url", "error_url", "client_reference", "restrict_payer_mobile", "aggregated_merchant_id"].includes(k))
    if (unknown.length) details.push({ loc: unknown, msg: "Champs inconnus de l'API Wave." })
    if (details.length) return send(res, 400, { code: "request-validation-error", message: "Requête invalide.", details })

    const sid = id("cos")
    const now = new Date()
    const session = {
      id: sid,
      amount: body.amount,
      currency: "XOF",
      business_name: "Sandbox AfriContext",
      checkout_status: "open",
      payment_status: "processing",
      client_reference: body.client_reference ?? null,
      success_url: body.success_url,
      error_url: body.error_url,
      wave_launch_url: `${PUBLIC_URL}/wave/pay/${sid}`,
      when_created: now.toISOString(),
      when_expires: new Date(now.getTime() + 30 * 60_000).toISOString(),
    }
    waveSessions.set(sid, session)
    return send(res, 200, session)
  }

  const m = path.match(/^\/v1\/checkout\/sessions\/([\w-]+)$/)
  if (req.method === "GET" && m) {
    const s = waveSessions.get(m[1])
    return s ? send(res, 200, s) : send(res, 404, { code: "not-found", message: "Session inconnue." })
  }
  return send(res, 404, { code: "not-found", message: `Endpoint Wave inexistant : ${req.method} ${path}. Voir /v1/checkout/sessions.` })
}

// --------------------------------------------------------- Orange Money
async function orange(req, res, path, body) {
  if (req.method === "POST" && path === "/oauth/v3/token") {
    if (!/^Basic\s+\S{8,}$/.test(req.headers.authorization ?? "")) return send(res, 401, { error: "invalid_client", error_description: "Authorization: Basic <client_id:client_secret en base64> requis." })
    if (body?.grant_type !== "client_credentials") return send(res, 400, { error: "unsupported_grant_type", error_description: "grant_type=client_credentials attendu (formulaire)." })
    const token = `om_${randomBytes(16).toString("hex")}`
    omTokens.add(token)
    return send(res, 200, { token_type: "Bearer", access_token: token, expires_in: 7776000 })
  }

  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/, "")
  if (!omTokens.has(token)) return send(res, 401, { code: 42, message: "Expired or invalid credentials", description: "Jeton OAuth absent ou expiré : appeler /oauth/v3/token." })

  let m = path.match(/^\/orange-money-webpay\/([a-z]{2}|dev)\/v1\/webpayment$/)
  if (req.method === "POST" && m) {
    const required = ["merchant_key", "currency", "order_id", "amount", "return_url", "cancel_url", "notif_url", "lang", "reference"]
    const missing = required.filter((k) => body?.[k] === undefined || body?.[k] === "")
    if (missing.length) return send(res, 400, { status: 400, message: "Bad Request", description: `Champs manquants : ${missing.join(", ")}` })
    if (!["XOF", "OUV"].includes(body.currency)) return send(res, 400, { status: 400, message: "Bad Request", description: "currency : OUV (test) ou XOF (production)." })
    if ([...omPayments.values()].some((p) => p.order_id === body.order_id)) return send(res, 400, { status: 400, message: "Bad Request", description: "order_id déjà utilisé." })
    const pay_token = `v1${randomBytes(12).toString("hex")}`
    const notif_token = randomBytes(12).toString("hex")
    omPayments.set(pay_token, { ...body, pay_token, notif_token, status: "INITIATED", txnid: null })
    return send(res, 201, { status: 201, message: "OK", pay_token, payment_url: `${PUBLIC_URL}/orange/pay/${pay_token}`, notif_token })
  }

  m = path.match(/^\/orange-money-webpay\/([a-z]{2}|dev)\/v1\/transactionstatus$/)
  if (req.method === "POST" && m) {
    const p = omPayments.get(body?.pay_token)
    if (!p || p.order_id !== body.order_id) return send(res, 404, { status: 404, message: "Transaction introuvable." })
    return send(res, 200, { status: p.status, order_id: p.order_id, txnid: p.txnid })
  }
  return send(res, 404, { status: 404, message: `Endpoint Orange inexistant : ${req.method} ${path}.` })
}

// -------------------------------------------------------------- FedaPay
async function fedapay(req, res, path, body) {
  const auth = req.headers.authorization ?? ""
  if (!/^Bearer\s+\S{8,}$/.test(auth)) return send(res, 401, { message: "Clé API invalide ou absente (Authorization: Bearer)." })

  if (req.method === "POST" && path === "/v1/transactions") {
    const errors = {}
    if (typeof body?.description !== "string" || !body.description) errors.description = ["est requis"]
    if (!Number.isInteger(body?.amount) || body.amount <= 0) errors.amount = ["doit être un entier positif"]
    if (body?.currency?.iso !== "XOF") errors.currency = ["currency.iso doit valoir XOF"]
    if (Object.keys(errors).length) return send(res, 422, { message: "Les données ne sont pas valides.", errors })
    const txId = Math.floor(Math.random() * 900000) + 100000
    const tx = { id: txId, reference: `trx_${randomBytes(4).toString("hex")}`, amount: body.amount, description: body.description, status: "pending", currency_id: 1 }
    fedaTx.set(txId, { ...tx, created_at: new Date().toISOString() })
    return send(res, 201, fedaTx.get(txId))
  }
  let m = path.match(/^\/v1\/transactions\/(\d+)\/token$/)
  if (req.method === "POST" && m) {
    const tx = fedaTx.get(Number(m[1]))
    if (!tx) return send(res, 404, { message: "Transaction introuvable." })
    const token = randomBytes(10).toString("hex")
    return send(res, 200, { token, url: `${PUBLIC_URL}/fedapay/pay/${token}` })
  }
  m = path.match(/^\/v1\/transactions\/(\d+)$/)
  if (req.method === "GET" && m) {
    const tx = fedaTx.get(Number(m[1]))
    return tx ? send(res, 200, tx) : send(res, 404, { message: "Transaction introuvable." })
  }
  return send(res, 404, { message: `Endpoint FedaPay inexistant : ${req.method} ${path}.` })
}

// ------------------------------------------------------------ Pilotage
async function control(req, res, path, body) {
  if (path === "/__sandbox/requests") return send(res, 200, { requests: log.slice(-100) })
  if (req.method === "POST" && path === "/__sandbox/reset") {
    log.length = 0
    waveSessions.clear(); omTokens.clear(); omPayments.clear(); fedaTx.clear(); hits.clear()
    return send(res, 200, { reset: true })
  }
  let m = path.match(/^\/__sandbox\/wave\/sessions\/([\w-]+)\/complete$/)
  if (req.method === "POST" && m) {
    const s = waveSessions.get(m[1])
    if (!s) return send(res, 404, { message: "Session inconnue." })
    Object.assign(s, { checkout_status: "complete", payment_status: "succeeded", transaction_id: id("T") })
    const event = { id: id("EV"), type: "checkout.session.completed", data: s }
    const raw = JSON.stringify(event)
    const delivery = body?.webhook_url ? await postWebhook(body.webhook_url, event, { "Wave-Signature": signWave(raw) }) : null
    return send(res, 200, { session: s, event, delivery })
  }
  m = path.match(/^\/__sandbox\/orange\/payments\/(\w+)\/complete$/)
  if (req.method === "POST" && m) {
    const p = omPayments.get(m[1])
    if (!p) return send(res, 404, { message: "Paiement inconnu." })
    Object.assign(p, { status: "SUCCESS", txnid: `MP${Date.now()}` })
    const delivery = await postWebhook(p.notif_url, { status: "SUCCESS", notif_token: p.notif_token, txnid: p.txnid })
    return send(res, 200, { payment: p, delivery })
  }
  if (req.method === "POST" && path === "/__sandbox/ai/v1/messages") {
    const prompt = body?.messages?.[0]?.content ?? ""
    const source = prompt.match(/URL source : (\S+)/)?.[1] ?? "https://example.com"
    const sections = ["Authentification", "Endpoints utilisés", "Erreurs", "Webhooks", "Idempotence et limites de débit", "Pièges courants", "Exemple minimal complet", "Variables d'environnement"]
    const text = `---\nslug: demo-checkout-api\ntitle: Démo — API Checkout\ndescription: Brouillon généré par le faux modèle de la sandbox à partir de la documentation fournie.\ntype: cursorrules\nservice: Démo\ncategory: paiement-mobile\npays: [CI, SN]\nversion_api: v1\nsource_url: ${source}\ntested_with: []\ntags: [fintech, checkout]\n---\n\n` + sections.map((t) => `## ${t}\nNon documenté dans la source.`).join("\n\n")
    return send(res, 200, { id: id("msg"), type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn" })
  }
  m = path.match(/^\/__sandbox\/docs\/([\w-]+)$/)
  if (req.method === "POST" && m) {
    docs.set(m[1], String(body?.html ?? ""))
    return send(res, 200, { updated: m[1] })
  }
  return send(res, 404, { message: "Route de pilotage inconnue." })
}

const routes = [
  ["/wave", wave],
  ["/orange", orange],
  ["/fedapay", fedapay],
]

const server = createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL)
  let raw = ""
  try {
    raw = await readBody(req)
  } catch {
    return send(res, 413, { message: "Corps trop volumineux." })
  }
  const body = parseBody(raw, req.headers["content-type"])
  const entry = { at: new Date().toISOString(), method: req.method, path: url.pathname, status: 0 }
  const end = res.end.bind(res)
  res.end = (...a) => {
    entry.status = res.statusCode
    if (!url.pathname.startsWith("/__sandbox")) log.push(entry)
    if (log.length > 500) log.shift()
    return end(...a)
  }

  if (url.pathname === "/health") return send(res, 200, { status: "ok", service: "africontext-sandbox" })
  if (url.pathname === "/") {
    return send(res, 200, {
      service: "AfriContext Sandbox",
      mocks: { wave: "/wave → https://api.wave.com", orange: "/orange → https://api.orange.com", fedapay: "/fedapay → https://(sandbox-)api.fedapay.com" },
      control: ["GET /__sandbox/requests", "POST /__sandbox/reset", "POST /__sandbox/wave/sessions/:id/complete {webhook_url}", "POST /__sandbox/orange/payments/:pay_token/complete", "POST /__sandbox/docs/:name {html}"],
    })
  }
  const doc = url.pathname.match(/^\/docs\/([\w-]+)$/)
  if (doc) return docs.has(doc[1]) ? send(res, 200, `<!doctype html><html><body>${docs.get(doc[1])}</body></html>`) : send(res, 404, "<h1>404</h1>")
  if (url.pathname.startsWith("/__sandbox")) return control(req, res, url.pathname, body)

  for (const [prefix, handler] of routes) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      return handler(req, res, url.pathname.slice(prefix.length) || "/", body)
    }
  }
  return send(res, 404, { message: "Inconnu. GET / pour la liste des mocks." })
})

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.mjs")) {
  server.listen(PORT, () => console.log(`AfriContext Sandbox sur ${PUBLIC_URL}`))
}

export { server }
