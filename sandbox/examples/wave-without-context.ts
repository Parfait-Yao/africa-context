// Code typique généré SANS contexte : endpoint inventé, en-tête inventé, devise invalide.
export async function createWaveCheckout(orderId: string, amount: number) {
  const res = await fetch("https://api.wave.com/v2/payments/create", {
    method: "POST",
    headers: { "X-API-KEY": process.env.WAVE_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "CFA", reference: orderId }),
  })
  const data = await res.json()
  return data.payment_url as string
}
