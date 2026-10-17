import type { Context, Proof } from "@/modules/contexts/context.types"

/**
 * ⚠️ DONNÉES DE DÉMONSTRATION
 * Elles alimentent le front tant que PostgreSQL n'est pas branché (DATA_SOURCE=mock)
 * et serviront de seed Prisma (prisma/seed.ts).
 * Le rôle "Contenu et vérification" doit revérifier chaque endpoint sur la
 * documentation officielle (source_url) avant la démo devant le jury.
 */

interface Sections {
  auth: string
  endpoints: string
  errors: string
  webhooks: string
  limits: string
  pitfalls: string
  example: string
  env: string[]
}

function body(s: Sections) {
  return `## Authentification
${s.auth}

## Endpoints utilisés
${s.endpoints}

## Erreurs
${s.errors}

## Webhooks
${s.webhooks}

## Idempotence et limites de débit
${s.limits}

## Pièges courants
${s.pitfalls}

## Exemple minimal complet
\`\`\`ts
${s.example.trim()}
\`\`\`

## Variables d'environnement
${s.env.map((e) => `- \`${e}\``).join("\n")}
`
}

const authors = {
  awa: { id: "u_awa", name: "Awa Koné", githubUrl: "https://github.com/", reputationScore: 412 },
  yao: { id: "u_yao", name: "Yao Kouassi", githubUrl: "https://github.com/", reputationScore: 288 },
  fatou: { id: "u_fatou", name: "Fatou Diop", githubUrl: "https://github.com/", reputationScore: 351 },
  kofi: { id: "u_kofi", name: "Kofi Mensah", githubUrl: "https://github.com/", reputationScore: 196 },
  leonie: { id: "u_leonie", name: "Léonie Gondo", githubUrl: "https://github.com/", reputationScore: 127 },
}

function proof(id: string, p: Omit<Proof, "id" | "createdAt"> & { createdAt?: string }): Proof {
  return { id, createdAt: p.createdAt ?? "2026-10-14T10:00:00.000Z", ...p }
}

export const mockContexts: Context[] = [
  {
    id: "ctx_wave",
    slug: "wave-checkout-api",
    title: "Wave — API Checkout",
    description:
      "Créer une session de paiement Wave, rediriger le client et confirmer le paiement par webhook signé.",
    type: "cursorrules",
    service: "Wave",
    category: "paiement-mobile",
    countries: ["SN", "CI"],
    apiVersion: "v1",
    sourceUrl: "https://docs.wave.com/checkout",
    testedWith: ["cursor", "claude-code"],
    tags: ["fintech", "paiement-mobile", "checkout", "webhook"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-10T08:00:00.000Z",
    author: authors.awa,
    stats: { views: 1840, copies: 412, installs: 236, upvotes: 64, downvotes: 2 },
    hasSandbox: true,
    versions: [
      { id: "v4", note: "Vérifié sur docs.wave.com : retrait d'un en-tête Idempotency-Key non documenté, URL HTTPS obligatoires, anti-rejeu du webhook", createdAt: "2026-10-17T00:30:00.000Z" },
      { id: "v3", note: "Ajout de la vérification de signature du webhook", createdAt: "2026-10-14T09:00:00.000Z" },
      { id: "v2", note: "Précision sur le montant en chaîne de caractères", createdAt: "2026-10-12T15:00:00.000Z" },
      { id: "v1", note: "Première version", createdAt: "2026-10-10T08:00:00.000Z" },
    ],
    proofs: [
      proof("p_wave_1", {
        prompt: "Ajoute un paiement Wave de 5 000 FCFA à mon checkout Next.js.",
        outputWithoutContext: `// ❌ Généré sans contexte
const res = await fetch("https://api.wave.com/v2/payments/create", {
  method: "POST",
  headers: { "X-API-KEY": process.env.WAVE_KEY },
  body: JSON.stringify({ amount: 5000, currency: "CFA", phone: customerPhone }),
})
// endpoint inexistant, en-tête inventé, devise invalide`,
        outputWithContext: `// ✅ Généré avec le contexte AfriContext
const res = await fetch("https://api.wave.com/v1/checkout/sessions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WAVE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: "5000",
    currency: "XOF",
    client_reference: orderId,
    success_url: \`\${APP_URL}/paiement/succes\`,
    error_url: \`\${APP_URL}/paiement/erreur\`,
  }),
})
const { wave_launch_url } = await res.json()`,
        model: "Claude Sonnet · Cursor",
        sandboxResult: "passed",
      }),
    ],
    content: body({
      auth: "Clé API envoyée dans l'en-tête `Authorization: Bearer $WAVE_API_KEY`. Une clé est liée à un seul compte marchand et à un pays. Ne jamais l'exposer côté navigateur : tous les appels partent du serveur.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /v1/checkout/sessions | amount (chaîne), currency (XOF), success_url (https), error_url (https) | client_reference (255 car. max), restrict_payer_mobile (E.164), aggregated_merchant_id (agrégateurs) |
| GET | /v1/checkout/sessions/:id | — | — |

Base URL : \`https://api.wave.com\`. La réponse de création contient \`id\`, \`wave_launch_url\` et \`checkout_status\`.`,
      errors: "`400` paramètre invalide (souvent `amount` envoyé en nombre ou avec décimales, ou URL de retour en http) · `401` clé absente ou révoquée · `429` trop de requêtes : réessayer avec un délai exponentiel. Les erreurs de paiement arrivent dans le champ `last_payment_error` du webhook.",
      webhooks: "Événements `checkout.session.completed` et `checkout.session.payment_failed`. En-tête `Wave-Signature: t=<timestamp>,v1=<signature>` : la signature est un HMAC-SHA256 (hex) de `timestamp + corps brut`, avec le secret de webhook fourni par Wave (pas la clé API). Vérifier **avant** de parser le JSON, refuser un timestamp de plus de 5 minutes, répondre `200` rapidement.",
      limits: "La documentation ne prévoit pas d'en-tête d'idempotence pour la création : stocker l'`id` de session et le `client_reference` pour ne pas recréer une session à chaque clic. Côté webhook, utiliser l'`id` de l'événement pour ignorer les doublons.",
      pitfalls: "- Les LLMs inventent `/v2/payments` ou `/checkout/create` : seul `/v1/checkout/sessions` existe.\n- `amount` est une **chaîne** sans décimales pour le XOF.\n- La devise est `XOF`, pas `CFA` ni `FCFA`.\n- `success_url` et `error_url` doivent être en **https**.\n- Pas d'en-tête `Idempotency-Key` documenté : ne pas en inventer.\n- `wave_launch_url` doit être ouvert par le navigateur de l'utilisateur.\n- Le statut final vient du webhook, pas de la redirection `success_url`.",
      example: `export async function createWaveCheckout(orderId: string, amount: number) {
  const res = await fetch("https://api.wave.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.WAVE_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(Math.round(amount)),
      currency: "XOF",
      client_reference: orderId,
      success_url: \`\${process.env.APP_URL}/paiement/succes\`,
      error_url: \`\${process.env.APP_URL}/paiement/erreur\`,
    }),
  })
  if (!res.ok) throw new Error(\`Wave \${res.status}\`)
  return (await res.json()) as { id: string; wave_launch_url: string }
}`,
      env: ["WAVE_API_KEY", "WAVE_WEBHOOK_SECRET", "APP_URL"],
    }),
  },
  {
    id: "ctx_om",
    slug: "orange-money-webpay",
    title: "Orange Money — Web Payment",
    description:
      "Obtenir un jeton OAuth, initier un paiement Web Payment Orange Money et traiter la notification de statut.",
    type: "claude_prompt",
    service: "Orange Money",
    category: "paiement-mobile",
    countries: ["CI", "SN", "ML", "BF", "CM"],
    apiVersion: "v1",
    sourceUrl: "https://developer.orange.com/apis/om-webpay",
    testedWith: ["claude-code", "cursor"],
    tags: ["fintech", "paiement-mobile", "oauth"],
    status: "to_recheck",
    lastVerifiedAt: "2026-10-13T11:00:00.000Z",
    createdAt: "2026-10-10T12:00:00.000Z",
    author: authors.yao,
    stats: { views: 1322, copies: 298, installs: 171, upvotes: 48, downvotes: 3 },
    hasSandbox: true,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-10T12:00:00.000Z" }],
    proofs: [
      proof("p_om_1", {
        prompt: "Intègre Orange Money Côte d'Ivoire à mon API Express.",
        outputWithoutContext: `// ❌ Sans contexte
await axios.post("https://api.orange.com/money/pay", {
  msisdn, amount, apiKey: "..."
})`,
        outputWithContext: `// ✅ Avec contexte
const { access_token } = await getOrangeToken() // OAuth client_credentials
const res = await fetch(
  "https://api.orange.com/orange-money-webpay/ci/v1/webpayment",
  {
    method: "POST",
    headers: { Authorization: \`Bearer \${access_token}\`, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_key: process.env.OM_MERCHANT_KEY,
      currency: "XOF", order_id: orderId, amount,
      return_url, cancel_url, notif_url, lang: "fr", reference: "Boutique",
    }),
  }
)`,
        model: "Claude Sonnet · Claude Code",
        sandboxResult: "passed",
      }),
    ],
    content: body({
      auth: "> La référence officielle Orange Money Web Payment est réservée aux marchands (accès via l'opérateur local) : vérifier chaque point avec la documentation remise par Orange.\n\nOAuth 2.0 `client_credentials` : `POST https://api.orange.com/oauth/v3/token` avec l'en-tête `Authorization: Basic $OM_AUTH_HEADER`. Le jeton obtenu expire : le mettre en cache et le renouveler avant expiration.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /orange-money-webpay/{pays}/v1/webpayment | merchant_key, currency, order_id, amount, return_url, cancel_url, notif_url, lang, reference | — |
| POST | /orange-money-webpay/{pays}/v1/transactionstatus | order_id, amount, pay_token | — |

\`{pays}\` vaut \`ci\`, \`sn\`, \`ml\`… L'environnement de test utilise la devise \`OUV\`.`,
      errors: "`401` jeton expiré : en redemander un. `400` souvent dû à `order_id` déjà utilisé ou à une devise qui ne correspond pas à l'environnement.",
      webhooks: "Orange appelle `notif_url` en POST avec `status`, `notif_token` et `txnid`. Comparer `notif_token` à celui reçu à l'initiation avant de valider la commande.",
      limits: "`order_id` doit être unique par paiement : il sert de clé d'idempotence. Ne pas relancer l'initiation sur un même `order_id`.",
      pitfalls: "- Les LLMs inventent un endpoint `/money/pay` et une `apiKey` dans le corps.\n- La devise de test (`OUV`) diffère de la production (`XOF`).\n- Le chemin dépend du pays.",
      example: `export async function getOrangeToken() {
  const res = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: {
      Authorization: \`Basic \${process.env.OM_AUTH_HEADER}\`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  return (await res.json()) as { access_token: string; expires_in: number }
}`,
      env: ["OM_AUTH_HEADER", "OM_MERCHANT_KEY", "OM_COUNTRY", "APP_URL"],
    }),
  },
  {
    id: "ctx_fedapay",
    slug: "fedapay-transactions",
    title: "FedaPay — Transactions et checkout",
    description: "Créer une transaction FedaPay, générer le lien de paiement et vérifier les événements webhook.",
    type: "cursorrules",
    service: "FedaPay",
    category: "agregateur",
    countries: ["BJ", "TG", "CI", "SN"],
    apiVersion: "v1",
    sourceUrl: "https://docs.fedapay.com",
    testedWith: ["cursor"],
    tags: ["fintech", "agregateur", "checkout"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-11T09:00:00.000Z",
    author: authors.kofi,
    stats: { views: 968, copies: 201, installs: 118, upvotes: 37, downvotes: 1 },
    hasSandbox: true,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-11T09:00:00.000Z" }],
    proofs: [
      proof("p_feda_1", {
        prompt: "Crée un paiement FedaPay de 2 000 FCFA.",
        outputWithoutContext: `// ❌ Sans contexte
fetch("https://api.fedapay.com/pay", { body: { amount: 2000, key } })`,
        outputWithContext: `// ✅ Avec contexte
const tx = await fetch(\`\${FEDAPAY_BASE}/v1/transactions\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.FEDAPAY_SECRET_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ description: "Commande 42", amount: 2000, currency: { iso: "XOF" }, customer: { email } }),
}).then(r => r.json())
const id = (tx["v1/transaction"] ?? tx).id
const { url } = await fetch(\`\${FEDAPAY_BASE}/v1/transactions/\${id}/token\`, { method: "POST", headers }).then(r => r.json())`,
        model: "GPT · Cursor",
        sandboxResult: "passed",
      }),
    ],
    content: body({
      auth: "Clé secrète dans `Authorization: Bearer $FEDAPAY_SECRET_KEY`. Base sandbox `https://sandbox-api.fedapay.com`, production `https://api.fedapay.com`.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /v1/transactions | description (chaîne), amount (entier), currency.iso (ex. XOF) | callback_url, customer (email, firstname, lastname, phone_number), custom_metadata |
| POST | /v1/transactions/:id/token | — | — (renvoie \`token\` et \`url\`) |
| GET | /v1/transactions/:id | — | — |

La référence décrit une réponse \`201\` contenant l'objet transaction (\`id\`, \`reference\`, \`amount\`, \`status\`…). Certaines réponses l'encapsulent sous la clé \`v1/transaction\` : lire les deux formes.`,
      errors: "`401` clé invalide ou mélange sandbox/production. `422` champ manquant ou montant invalide.",
      webhooks: "Événements `transaction.created`, `transaction.approved`, `transaction.declined`, `transaction.canceled`, `transaction.transferred`, `transaction.updated`. Vérifier l'en-tête `X-FEDAPAY-SIGNATURE` sur le corps brut avec la bibliothèque officielle (`Webhook.constructEvent(body, sig, secret)`) ; le secret est propre à chaque endpoint et différent en test et en production. Signature invalide → répondre `400`.",
      limits: "Conserver l'id de transaction côté commande pour éviter les doublons. Interroger `GET /v1/transactions/:id` si le webhook n'arrive pas.",
      pitfalls: "- `amount` est un **entier** et la devise un objet `{ iso: \"XOF\" }`.\n- Le lien de paiement s'obtient via `/token`, pas dans la création.\n- Les clés sandbox ne marchent pas sur l'URL de production (et inversement).",
      example: `const base = process.env.FEDAPAY_ENV === "live" ? "https://api.fedapay.com" : "https://sandbox-api.fedapay.com"
export async function createFedapayLink(amount: number, email: string) {
  const headers = { Authorization: \`Bearer \${process.env.FEDAPAY_SECRET_KEY}\`, "Content-Type": "application/json" }
  const created = await fetch(\`\${base}/v1/transactions\`, {
    method: "POST", headers,
    body: JSON.stringify({ description: "Commande", amount, currency: { iso: "XOF" }, customer: { email } }),
  }).then((r) => r.json())
  const id = (created["v1/transaction"] ?? created).id as number
  const token = await fetch(\`\${base}/v1/transactions/\${id}/token\`, { method: "POST", headers }).then((r) => r.json())
  return token.url as string
}`,
      env: ["FEDAPAY_SECRET_KEY", "FEDAPAY_WEBHOOK_SECRET", "FEDAPAY_ENV"],
    }),
  },
  {
    id: "ctx_mtn",
    slug: "mtn-momo-collection",
    title: "MTN MoMo — Collection (Request to Pay)",
    description: "Demander un paiement MTN Mobile Money, suivre son statut et gérer l'environnement sandbox.",
    type: "claude_prompt",
    service: "MTN MoMo",
    category: "paiement-mobile",
    countries: ["CI", "CM", "GH", "BJ", "UG", "RW"],
    apiVersion: "v1_0",
    sourceUrl: "https://momodeveloper.mtn.com/api-documentation",
    testedWith: ["claude-code"],
    tags: ["fintech", "paiement-mobile", "collection"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-10T16:00:00.000Z",
    author: authors.fatou,
    stats: { views: 1104, copies: 233, installs: 129, upvotes: 41, downvotes: 4 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-10T16:00:00.000Z" }],
    proofs: [
      proof("p_mtn_1", {
        prompt: "Encaisse 1 000 FCFA via MTN MoMo.",
        outputWithoutContext: `// ❌ Sans contexte
POST https://api.mtn.com/momo/charge { phone, amount }`,
        outputWithContext: `// ✅ Avec contexte
POST {MOMO_BASE}/collection/v1_0/requesttopay
X-Reference-Id: <uuid v4>
X-Target-Environment: sandbox
Ocp-Apim-Subscription-Key: $MOMO_COLLECTION_KEY
Authorization: Bearer <token>
{ "amount": "1000", "currency": "EUR", "externalId": "42",
  "payer": { "partyIdType": "MSISDN", "partyId": "46733123453" } }`,
        model: "Claude Sonnet · Claude Code",
      }),
    ],
    content: body({
      auth: "Jeton via `POST /collection/token/` (Basic avec API user + API key). Chaque appel envoie aussi `Ocp-Apim-Subscription-Key` et `X-Target-Environment`.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /collection/v1_0/requesttopay | amount, currency, externalId, payer | payerMessage, payeeNote |
| GET | /collection/v1_0/requesttopay/{referenceId} | — | — |`,
      errors: "`202` accepté (traitement asynchrone). `409` X-Reference-Id déjà utilisé. `500 RESOURCE_NOT_FOUND` lors d'un GET trop rapide.",
      webhooks: "Callback optionnel via l'en-tête `X-Callback-Url`. Toujours confirmer le statut par un `GET` sur la référence.",
      limits: "`X-Reference-Id` (UUID v4) est la clé d'idempotence. Interroger le statut avec un délai croissant.",
      pitfalls: "- La sandbox n'accepte que la devise `EUR`.\n- La réponse `202` n'a pas de corps : le statut se lit ensuite.\n- Les LLMs inventent un endpoint `/charge` unique.",
      example: `import { randomUUID } from "node:crypto"
export async function requestToPay(token: string, amount: string, msisdn: string) {
  const ref = randomUUID()
  const res = await fetch(\`\${process.env.MOMO_BASE_URL}/collection/v1_0/requesttopay\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${token}\`,
      "X-Reference-Id": ref,
      "X-Target-Environment": process.env.MOMO_TARGET_ENV ?? "sandbox",
      "Ocp-Apim-Subscription-Key": process.env.MOMO_COLLECTION_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency: "EUR", externalId: ref, payer: { partyIdType: "MSISDN", partyId: msisdn } }),
  })
  if (res.status !== 202) throw new Error(\`MoMo \${res.status}\`)
  return ref
}`,
      env: ["MOMO_BASE_URL", "MOMO_COLLECTION_KEY", "MOMO_API_USER", "MOMO_API_KEY", "MOMO_TARGET_ENV"],
    }),
  },
  {
    id: "ctx_cinetpay",
    slug: "cinetpay-checkout",
    title: "CinetPay — Guichet de paiement",
    description: "Initialiser un paiement CinetPay multi-opérateurs et vérifier la transaction après notification.",
    type: "cursorrules",
    service: "CinetPay",
    category: "agregateur",
    countries: ["CI", "SN", "CM", "BF", "ML", "TG", "BJ"],
    apiVersion: "v2",
    sourceUrl: "https://docs.cinetpay.com",
    testedWith: ["cursor", "claude-code"],
    tags: ["fintech", "agregateur", "checkout"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-11T14:00:00.000Z",
    author: authors.leonie,
    stats: { views: 876, copies: 164, installs: 92, upvotes: 29, downvotes: 1 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-11T14:00:00.000Z" }],
    proofs: [],
    content: body({
      auth: "Les identifiants `apikey` et `site_id` sont envoyés dans le corps JSON, depuis le serveur uniquement.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | https://api-checkout.cinetpay.com/v2/payment | apikey, site_id, transaction_id, amount, currency, description, notify_url, return_url, channels | customer_* (requis pour proposer la carte bancaire), customer_id |
| POST | https://api-checkout.cinetpay.com/v2/payment/check | apikey, site_id, transaction_id | — |`,
      errors: "Le code métier est dans le corps (`code`) : `\"201\"` / `CREATED` à l'initialisation, avec `data.payment_url` et `data.payment_token` ; `00` succès à la vérification ; tout autre code doit être journalisé.",
      webhooks: "CinetPay appelle `notify_url` avec `cpm_trans_id`. Ne jamais faire confiance à la notification seule : appeler `/v2/payment/check`.",
      limits: "`transaction_id` unique par paiement. Les montants XOF doivent être des multiples de 5.",
      pitfalls: "- Les LLMs placent `apikey` dans un en-tête.\n- Le statut final se lit via `/payment/check`.\n- Montant non multiple de 5 refusé.",
      example: `export async function initCinetpay(transactionId: string, amount: number) {
  const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount, currency: "XOF", description: "Commande",
      notify_url: \`\${process.env.APP_URL}/api/cinetpay/notify\`,
      return_url: \`\${process.env.APP_URL}/paiement/retour\`,
      channels: "ALL",
    }),
  })
  const json = await res.json()
  return json.data.payment_url as string
}`,
      env: ["CINETPAY_API_KEY", "CINETPAY_SITE_ID", "APP_URL"],
    }),
  },
  {
    id: "ctx_paydunya",
    slug: "paydunya-checkout-invoice",
    title: "PayDunya — Facture de paiement",
    description: "Créer une facture PayDunya, rediriger le client et confirmer via l'IPN.",
    type: "claude_prompt",
    service: "PayDunya",
    category: "agregateur",
    countries: ["SN", "CI", "BJ", "TG", "BF", "ML"],
    apiVersion: "v1",
    sourceUrl: "https://developers.paydunya.com",
    testedWith: ["claude-code"],
    tags: ["fintech", "agregateur"],
    status: "to_recheck",
    lastVerifiedAt: "2026-09-02T09:00:00.000Z",
    createdAt: "2026-09-01T09:00:00.000Z",
    author: authors.fatou,
    stats: { views: 512, copies: 88, installs: 41, upvotes: 15, downvotes: 3 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-09-01T09:00:00.000Z" }],
    proofs: [],
    content: body({
      auth: "Trois en-têtes : `PAYDUNYA-MASTER-KEY`, `PAYDUNYA-PRIVATE-KEY`, `PAYDUNYA-TOKEN`. Base test : `https://app.paydunya.com/sandbox-api/v1`.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /checkout-invoice/create | invoice.total_amount, store.name | invoice.items, actions.callback_url |
| GET | /checkout-invoice/confirm/{token} | — | — |`,
      errors: "`response_code` `00` = succès. Tout autre code est accompagné de `response_text`.",
      webhooks: "IPN envoyé à `callback_url` avec un `hash` SHA-512 de la master key à comparer.",
      limits: "Confirmer chaque facture une seule fois côté serveur.",
      pitfalls: "- Mélange des URL sandbox et production.\n- Oubli de l'en-tête `PAYDUNYA-TOKEN`.",
      example: `export async function createInvoice(total: number) {
  const res = await fetch(\`\${process.env.PAYDUNYA_BASE_URL}/checkout-invoice/create\`, {
    method: "POST",
    headers: {
      "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY!,
      "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY!,
      "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invoice: { total_amount: total, description: "Commande" }, store: { name: "Boutique" } }),
  })
  return res.json()
}`,
      env: ["PAYDUNYA_BASE_URL", "PAYDUNYA_MASTER_KEY", "PAYDUNYA_PRIVATE_KEY", "PAYDUNYA_TOKEN"],
    }),
  },
  {
    id: "ctx_paystack",
    slug: "paystack-initialize-transaction",
    title: "Paystack — Initialiser et vérifier une transaction",
    description: "Initialiser une transaction Paystack, vérifier son statut et valider la signature du webhook.",
    type: "cursorrules",
    service: "Paystack",
    category: "agregateur",
    countries: ["NG", "GH", "KE", "CI"],
    apiVersion: "v1",
    sourceUrl: "https://paystack.com/docs/api/transaction",
    testedWith: ["cursor", "claude-code"],
    tags: ["fintech", "agregateur", "webhook"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-12T08:00:00.000Z",
    author: authors.kofi,
    stats: { views: 702, copies: 140, installs: 77, upvotes: 26, downvotes: 0 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-12T08:00:00.000Z" }],
    proofs: [
      proof("p_paystack_1", {
        prompt: "Accepte un paiement Paystack de 5 000 NGN.",
        outputWithoutContext: `// ❌ Sans contexte
amount: 5000 // en nairas`,
        outputWithContext: `// ✅ Avec contexte
amount: 5000 * 100 // Paystack attend la plus petite unité (kobo)`,
        model: "Claude Sonnet · Cursor",
      }),
    ],
    content: body({
      auth: "`Authorization: Bearer $PAYSTACK_SECRET_KEY`. La clé publique ne sert qu'au front (Popup/Inline).",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | https://api.paystack.co/transaction/initialize | email, amount (plus petite unité) | reference, callback_url, currency |
| GET | https://api.paystack.co/transaction/verify/:reference | — | — |`,
      errors: "`status: false` dans le corps avec `message`. `401` clé invalide.",
      webhooks: "Vérifier `x-paystack-signature` : HMAC-SHA512 du corps brut avec la clé secrète. Événement principal : `charge.success`.",
      limits: "`reference` unique par transaction. Vérifier via `/verify` avant de livrer.",
      pitfalls: "- `amount` en kobo/pesewas (×100).\n- Les LLMs oublient la vérification de signature.",
      example: `export async function initPaystack(email: string, amountNaira: number, reference: string) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: \`Bearer \${process.env.PAYSTACK_SECRET_KEY}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: Math.round(amountNaira * 100), reference }),
  })
  const json = await res.json()
  return json.data.authorization_url as string
}`,
      env: ["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"],
    }),
  },
  {
    id: "ctx_flutterwave",
    slug: "flutterwave-standard-payments",
    title: "Flutterwave — Paiements Standard",
    description: "Créer un lien de paiement Flutterwave Standard et vérifier la transaction par webhook.",
    type: "cursorrules",
    service: "Flutterwave",
    category: "agregateur",
    countries: ["NG", "GH", "KE", "UG", "CM", "CI", "SN"],
    apiVersion: "v3",
    sourceUrl: "https://developer.flutterwave.com/docs",
    testedWith: ["cursor"],
    tags: ["fintech", "agregateur", "checkout"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-12T10:00:00.000Z",
    author: authors.yao,
    stats: { views: 640, copies: 121, installs: 63, upvotes: 22, downvotes: 1 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-12T10:00:00.000Z" }],
    proofs: [],
    content: body({
      auth: "`Authorization: Bearer $FLW_SECRET_KEY`.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | https://api.flutterwave.com/v3/payments | tx_ref, amount, currency, redirect_url, customer.email | payment_options, customizations |
| GET | https://api.flutterwave.com/v3/transactions/:id/verify | — | — |`,
      errors: "`status: \"error\"` avec `message`. Vérifier aussi que `amount` et `currency` reçus correspondent à la commande.",
      webhooks: "Flutterwave renvoie le hash secret défini dans le tableau de bord dans l'en-tête `verif-hash` : le comparer à `FLW_WEBHOOK_HASH`, sinon ignorer la requête. Événement de paiement réussi : `charge.completed` (avec `data.status = \"successful\"`), à confirmer par `/verify`.",
      limits: "`tx_ref` unique par paiement.",
      pitfalls: "- Les LLMs utilisent l'ancienne API v2 (`/flwv3-pug/...`).\n- Sans `currency`, Flutterwave suppose `NGN` : toujours la préciser.\n- `tx_ref` doit être unique par transaction.\n- Ne pas livrer sans appel à `/verify`.",
      example: `export async function createFlwLink(txRef: string, amount: number, email: string) {
  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: { Authorization: \`Bearer \${process.env.FLW_SECRET_KEY}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ tx_ref: txRef, amount, currency: "XOF", redirect_url: \`\${process.env.APP_URL}/paiement/retour\`, customer: { email } }),
  })
  return (await res.json()).data.link as string
}`,
      env: ["FLW_SECRET_KEY", "FLW_WEBHOOK_HASH", "APP_URL"],
    }),
  },
  {
    id: "ctx_at_sms",
    slug: "africastalking-sms",
    title: "Africa's Talking — Envoi de SMS",
    description: "Envoyer des SMS transactionnels via Africa's Talking et recevoir les rapports de livraison.",
    type: "claude_prompt",
    service: "Africa's Talking",
    category: "sms",
    countries: ["KE", "UG", "NG", "RW", "CI"],
    apiVersion: "version1",
    sourceUrl: "https://developers.africastalking.com/docs/sms/sending",
    testedWith: ["claude-code", "cursor"],
    tags: ["sms", "otp", "messagerie"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-11T11:00:00.000Z",
    author: authors.awa,
    stats: { views: 588, copies: 132, installs: 70, upvotes: 24, downvotes: 0 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-11T11:00:00.000Z" }],
    proofs: [],
    content: body({
      auth: "En-tête `apiKey: $AT_API_KEY` et champ `username` (`sandbox` en test).",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | https://api.africastalking.com/version1/messaging | username, to, message | from, enqueue |

Corps en \`application/x-www-form-urlencoded\`, en-tête \`Accept: application/json\`. Sandbox : \`https://api.sandbox.africastalking.com/version1/messaging\` avec \`username=sandbox\`. \`from\` = shortcode ou identifiant alphanumérique enregistré sur le compte.`,
      errors: "Succès = HTTP `201 Created` (pas 200). Statut par destinataire dans `SMSMessageData.Recipients[].status` (ex. `Success`, `InvalidPhoneNumber`).",
      webhooks: "Rapports de livraison envoyés à l'URL configurée dans le tableau de bord, avec `id`, `status`, `phoneNumber`.",
      limits: "Regrouper les destinataires (séparés par des virgules) plutôt que d'enchaîner les appels.",
      pitfalls: "- Les LLMs envoient du JSON : l'API attend un formulaire encodé.\n- L'en-tête s'appelle `apiKey` (pas `Authorization`).\n- Un succès renvoie `201`, pas `200`.\n- En sandbox, `username` vaut toujours `sandbox`.\n- Numéros au format international `+225…`.",
      example: `export async function sendSms(to: string[], message: string) {
  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { apiKey: process.env.AT_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: process.env.AT_USERNAME!, to: to.join(","), message }),
  })
  return res.json()
}`,
      env: ["AT_API_KEY", "AT_USERNAME"],
    }),
  },
  {
    id: "ctx_orange_sms",
    slug: "orange-sms-api",
    title: "Orange SMS API — SMS Afrique",
    description: "Envoyer des SMS via l'API Orange SMS (OAuth + numéro expéditeur) en Afrique de l'Ouest et du Centre.",
    type: "mcp_server",
    service: "Orange SMS",
    category: "sms",
    countries: ["CI", "SN", "CM", "ML", "BF"],
    apiVersion: "v1",
    sourceUrl: "https://developer.orange.com/apis/sms",
    testedWith: ["claude-code"],
    tags: ["sms", "oauth", "messagerie"],
    status: "approved",
    lastVerifiedAt: "2026-10-17T00:30:00.000Z",
    createdAt: "2026-10-10T09:00:00.000Z",
    author: authors.yao,
    stats: { views: 430, copies: 76, installs: 39, upvotes: 14, downvotes: 1 },
    hasSandbox: false,
    versions: [{ id: "v1", note: "Première version", createdAt: "2026-10-10T09:00:00.000Z" }],
    proofs: [],
    content: body({
      auth: "Jeton OAuth `client_credentials` via `https://api.orange.com/oauth/v3/token`, puis `Authorization: Bearer <token>`.",
      endpoints: `| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /smsmessaging/v1/outbound/tel%3A%2B{expediteur}/requests | outboundSMSMessageRequest.address, senderAddress, outboundSMSTextMessage.message | senderName |`,
      errors: "`401` jeton expiré : en redemander un. `400 requestError` si le `senderName` n'est pas approuvé par Orange. Bundle épuisé ou contrat expiré : erreur dont le détail est dans le corps de la réponse (la documentation ne donne pas de code précis).",
      webhooks: "Notifications de livraison via un abonnement (`/smsmessaging/v1/outbound/{sender}/subscriptions`).",
      limits: "Le nombre de SMS dépend du bundle acheté : vérifier le solde avant les envois massifs.",
      pitfalls: "- Le numéro expéditeur doit être encodé dans l'URL (`tel%3A%2B225…`).\n- Les LLMs oublient le préfixe `tel:+`.",
      example: `export async function sendOrangeSms(token: string, to: string, message: string) {
  const sender = encodeURIComponent(\`tel:+\${process.env.ORANGE_SMS_SENDER}\`)
  return fetch(\`https://api.orange.com/smsmessaging/v1/outbound/\${sender}/requests\`, {
    method: "POST",
    headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
    body: JSON.stringify({
      outboundSMSMessageRequest: {
        address: \`tel:+\${to}\`,
        senderAddress: \`tel:+\${process.env.ORANGE_SMS_SENDER}\`,
        outboundSMSTextMessage: { message },
      },
    }),
  })
}`,
      env: ["ORANGE_SMS_AUTH_HEADER", "ORANGE_SMS_SENDER"],
    }),
  },
  // --- Soumissions en attente (visibles uniquement dans le back-office) ---
  {
    id: "ctx_moov",
    slug: "moov-money-flooz",
    title: "Moov Money (Flooz) — Paiement marchand",
    description: "Initier un paiement marchand Moov Money au Togo et au Bénin.",
    type: "cursorrules",
    service: "Moov Money",
    category: "paiement-mobile",
    countries: ["TG", "BJ", "CI"],
    apiVersion: "v1",
    sourceUrl: "https://www.moov-africa.ci",
    testedWith: [],
    tags: ["fintech", "paiement-mobile"],
    status: "pending",
    lastVerifiedAt: "2026-10-15T10:00:00.000Z",
    createdAt: "2026-10-15T10:00:00.000Z",
    author: authors.leonie,
    stats: { views: 0, copies: 0, installs: 0, upvotes: 0, downvotes: 0 },
    hasSandbox: false,
    versions: [],
    proofs: [],
    content: "## Authentification\nÀ compléter par le contributeur.\n",
  },
  {
    id: "ctx_hub2",
    slug: "hub2-payin",
    title: "Hub2 — Pay-in multi-opérateurs",
    description: "Collecter des paiements via Hub2 sur plusieurs opérateurs de mobile money.",
    type: "claude_prompt",
    service: "Hub2",
    category: "agregateur",
    countries: ["CI", "SN"],
    apiVersion: "v1",
    sourceUrl: "https://docs.hub2.io",
    testedWith: ["claude-code"],
    tags: ["fintech", "agregateur"],
    status: "pending",
    lastVerifiedAt: "2026-10-16T08:00:00.000Z",
    createdAt: "2026-10-16T08:00:00.000Z",
    author: authors.kofi,
    stats: { views: 0, copies: 0, installs: 0, upvotes: 0, downvotes: 0 },
    hasSandbox: false,
    versions: [],
    proofs: [],
    content: "## Authentification\nÀ compléter par le contributeur.\n",
  },
]

export const mockReports = [
  {
    id: "r1",
    contextSlug: "paydunya-checkout-invoice",
    contextTitle: "PayDunya — Facture de paiement",
    reason: "L'URL sandbox a changé, le contexte renvoie une 404.",
    reporter: "Yao Kouassi",
    status: "open" as const,
    createdAt: "2026-10-15T18:20:00.000Z",
  },
  {
    id: "r2",
    contextSlug: "mtn-momo-collection",
    contextTitle: "MTN MoMo — Collection (Request to Pay)",
    reason: "Préciser la devise attendue en production.",
    reporter: "Awa Koné",
    status: "open" as const,
    createdAt: "2026-10-16T07:05:00.000Z",
  },
]
