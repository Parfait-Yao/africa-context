/**
 * Identité visuelle des services couverts : logo officiel (favicon servi depuis /public/logos)
 * et couleur de marque, utilisée pour les halos et le monogramme de repli.
 */
export const SERVICE_BRANDS: Record<string, { logo: string; color: string }> = {
  Wave: { logo: "/logos/wave.png", color: "#1dc8f2" },
  "Orange Money": { logo: "/logos/orange-money.png", color: "#ff7900" },
  "Orange SMS": { logo: "/logos/orange-sms.png", color: "#ff7900" },
  "MTN MoMo": { logo: "/logos/mtn-momo.png", color: "#ffcb05" },
  "Moov Money": { logo: "/logos/moov-money.png", color: "#0066b3" },
  FedaPay: { logo: "/logos/fedapay.png", color: "#00a86b" },
  CinetPay: { logo: "/logos/cinetpay.png", color: "#ef4135" },
  Flutterwave: { logo: "/logos/flutterwave.png", color: "#f5a623" },
  Hub2: { logo: "/logos/hub2.png", color: "#e8336d" },
  PayDunya: { logo: "/logos/paydunya.png", color: "#0b72b9" },
  Paystack: { logo: "/logos/paystack.png", color: "#0ba4db" },
  "Africa's Talking": { logo: "/logos/africas-talking.png", color: "#f58220" },
}

export function serviceBrand(name: string) {
  return SERVICE_BRANDS[name]
}
