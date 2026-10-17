/** Exécuté dans le processus isolé : charge le code généré et joue un scénario. */
import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

const [file, scenario] = process.argv.slice(2)
const SANDBOX = process.env.AFRICONTEXT_SANDBOX_URL ?? "http://localhost:4010"
const checks = []
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail })

function pickFunction(mod, names) {
  for (const n of names) if (typeof mod[n] === "function") return [n, mod[n]]
  if (typeof mod.default === "function") return ["default", mod.default]
  const any = Object.entries(mod).find(([, v]) => typeof v === "function")
  return any ?? [null, null]
}

async function sandboxRequests() {
  const r = await fetch(`${SANDBOX}/__sandbox/requests`)
  return (await r.json()).requests
}

function webhookReceiver() {
  return new Promise((resolve) => {
    const received = []
    const srv = createServer((req, res) => {
      let body = ""
      req.on("data", (c) => (body += c))
      req.on("end", () => {
        received.push({ headers: req.headers, body })
        res.writeHead(200).end("ok")
      })
    })
    srv.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${srv.address().port}/webhooks`, received, close: () => srv.close() }))
  })
}

async function wave(mod) {
  const [name, fn] = pickFunction(mod, ["createWaveCheckout", "createCheckout", "createCheckoutSession", "createWavePayment"])
  check("Une fonction exportée crée le paiement", fn, name ? `fonction ${name}()` : "aucune fonction exportée")
  if (!fn) return
  let result, error
  try {
    result = await fn("order-42", 5000)
  } catch (e) {
    error = e
  }
  const reqs = await sandboxRequests()
  const call = reqs.filter((r) => r.path.startsWith("/wave")).at(-1)
  check("Appelle l'endpoint réel POST /v1/checkout/sessions", call?.method === "POST" && call.path === "/wave/v1/checkout/sessions", call ? `${call.method} ${call.path.replace("/wave", "")}` : "aucun appel à Wave")
  check("La requête est acceptée par Wave (2xx)", call && call.status >= 200 && call.status < 300, call ? `statut ${call.status}` : "—")
  const url = typeof result === "string" ? result : result?.wave_launch_url
  check("Renvoie l'URL de paiement wave_launch_url", typeof url === "string" && url.includes("/wave/pay/"), error ? `exception : ${error.message}` : url ?? "absente")

  const sessionId = typeof result === "object" && result?.id ? result.id : url?.split("/").at(-1)
  if (sessionId && typeof mod.verifyWaveSignature === "function") {
    const hook = await webhookReceiver()
    await fetch(`${SANDBOX}/__sandbox/wave/sessions/${sessionId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhook_url: hook.url }) })
    const got = hook.received[0]
    hook.close()
    const okSig = got && (await mod.verifyWaveSignature(got.body, got.headers["wave-signature"], process.env.WAVE_WEBHOOK_SECRET))
    const forged = got && (await mod.verifyWaveSignature(got.body.replace("succeeded", "failed"), got.headers["wave-signature"], process.env.WAVE_WEBHOOK_SECRET))
    check("Vérifie la signature du webhook (accepte la vraie, refuse une falsifiée)", okSig && !forged, okSig ? (forged ? "accepte un corps modifié" : "ok") : "signature valide refusée")
  }
}

async function orange(mod) {
  const [name, fn] = pickFunction(mod, ["createOrangePayment", "initOrangeMoneyPayment", "createPayment"])
  check("Une fonction exportée initie le paiement", fn, name ?? "aucune")
  if (!fn) return
  let result, error
  try {
    result = await fn("order-42", 5000)
  } catch (e) {
    error = e
  }
  const reqs = (await sandboxRequests()).filter((r) => r.path.startsWith("/orange"))
  check("Obtient un jeton OAuth (/oauth/v3/token)", reqs.some((r) => r.path === "/orange/oauth/v3/token" && r.status === 200), reqs.map((r) => `${r.path} ${r.status}`).join(", ") || "aucun appel")
  check("Initie le paiement /webpayment (201)", reqs.some((r) => /\/v1\/webpayment$/.test(r.path) && r.status === 201), error?.message ?? "")
  const url = typeof result === "string" ? result : result?.payment_url
  check("Renvoie payment_url", typeof url === "string" && url.includes("/orange/pay/"), url ?? "absente")
}

async function fedapay(mod) {
  const [name, fn] = pickFunction(mod, ["createFedapayLink", "createFedapayPayment", "createPayment"])
  check("Une fonction exportée crée le paiement", fn, name ?? "aucune")
  if (!fn) return
  let result, error
  try {
    result = await fn(2000, "client@example.com")
  } catch (e) {
    error = e
  }
  const reqs = (await sandboxRequests()).filter((r) => r.path.startsWith("/fedapay"))
  check("Crée la transaction (POST /v1/transactions)", reqs.some((r) => r.path === "/fedapay/v1/transactions" && r.status === 201), reqs.map((r) => `${r.path} ${r.status}`).join(", ") || "aucun appel")
  check("Génère le lien via /token", reqs.some((r) => /\/token$/.test(r.path) && r.status === 200), error?.message ?? "")
  const url = typeof result === "string" ? result : result?.url
  check("Renvoie l'URL de paiement", typeof url === "string" && url.includes("/fedapay/pay/"), url ?? "absente")
}

const scenarios = { wave, orange, fedapay }

try {
  await fetch(`${SANDBOX}/__sandbox/reset`, { method: "POST" })
  const mod = await import(pathToFileURL(file).href)
  await scenarios[scenario](mod)
} catch (e) {
  check("Le module se charge et s'exécute", false, e.message)
}
process.stdout.write(JSON.stringify({ scenario, file, passed: checks.length > 0 && checks.every((c) => c.ok), checks }) + "\n")
process.exit(0)
