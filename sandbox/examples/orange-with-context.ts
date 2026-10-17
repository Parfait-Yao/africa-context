// Code généré AVEC le contexte AfriContext orange-money-webpay.
async function getOrangeToken() {
  const res = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: { Authorization: `Basic ${process.env.OM_AUTH_HEADER}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  })
  return (await res.json()) as { access_token: string }
}

export async function createOrangePayment(orderId: string, amount: number) {
  const { access_token } = await getOrangeToken()
  const country = process.env.OM_COUNTRY ?? "ci"
  const res = await fetch(`https://api.orange.com/orange-money-webpay/${country}/v1/webpayment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_key: process.env.OM_MERCHANT_KEY,
      currency: country === "dev" ? "OUV" : "XOF",
      order_id: orderId,
      amount,
      return_url: `${process.env.APP_URL}/paiement/retour`,
      cancel_url: `${process.env.APP_URL}/paiement/annule`,
      notif_url: `${process.env.APP_URL}/api/orange/notif`,
      lang: "fr",
      reference: "Boutique",
    }),
  })
  return (await res.json()) as { payment_url: string; pay_token: string; notif_token: string }
}
