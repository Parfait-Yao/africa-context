// Code généré AVEC le contexte AfriContext fedapay-transactions.
const base = process.env.FEDAPAY_ENV === "live" ? "https://api.fedapay.com" : "https://sandbox-api.fedapay.com"

export async function createFedapayLink(amount: number, email: string) {
  const headers = { Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`, "Content-Type": "application/json" }
  const created = await fetch(`${base}/v1/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ description: "Commande", amount, currency: { iso: "XOF" }, customer: { email } }),
  }).then((r) => r.json())
  const id = (created["v1/transaction"] ?? created).id as number
  const token = await fetch(`${base}/v1/transactions/${id}/token`, { method: "POST", headers }).then((r) => r.json())
  return token.url as string
}
