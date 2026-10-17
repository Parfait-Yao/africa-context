const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const numberFmt = new Intl.NumberFormat("fr-FR")

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso))
}

export function formatNumber(n: number) {
  return numberFmt.format(n)
}
