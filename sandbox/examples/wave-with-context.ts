// Code généré AVEC le contexte AfriContext wave-checkout-api.
import { createHmac, timingSafeEqual } from "node:crypto"

export async function createWaveCheckout(orderId: string, amount: number) {
  const res = await fetch("https://api.wave.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(Math.round(amount)),
      currency: "XOF",
      client_reference: orderId,
      success_url: `${process.env.APP_URL}/paiement/succes`,
      error_url: `${process.env.APP_URL}/paiement/erreur`,
    }),
  })
  if (!res.ok) throw new Error(`Wave ${res.status}`)
  return (await res.json()) as { id: string; wave_launch_url: string }
}

/** En-tête Wave-Signature : t=<timestamp>,v1=<HMAC-SHA256(secret, timestamp + corps brut)> */
export function verifyWaveSignature(rawBody: string, header: string | undefined, secret: string | undefined) {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]))
  if (!parts.t || !parts.v1) return false
  // Anti-rejeu : refuser un webhook de plus de 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const expected = createHmac("sha256", secret).update(`${parts.t}${rawBody}`).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}
