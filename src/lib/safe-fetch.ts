import "server-only"
import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

/**
 * Récupère une page externe sans exposer le réseau interne (protection SSRF) :
 * http(s) uniquement, IP privées / loopback / link-local refusées, redirections revérifiées,
 * délai et taille maximum. ALLOW_PRIVATE_FETCH=true l'autorise en développement (sandbox locale).
 */
const BLOCKED = new BlockList()
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(net, prefix, "ipv4")
for (const [net, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96]] as const) BLOCKED.addSubnet(net, prefix, "ipv6")

/** IP interne ? Les IPv4 écrites en IPv6 (::ffff:a.b.c.d ou ::ffff:7f00:1) sont ramenées en IPv4. */
export function isPrivateAddress(address: string) {
  const ip = address.toLowerCase()
  const mapped = ip.match(/^::ffff:(?:0:)?(.+)$/)
  if (mapped) {
    const rest = mapped[1]
    const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    const v4 = hex ? [parseInt(hex[1], 16) >> 8, parseInt(hex[1], 16) & 255, parseInt(hex[2], 16) >> 8, parseInt(hex[2], 16) & 255].join(".") : rest
    if (isIP(v4) === 4) return BLOCKED.check(v4, "ipv4")
  }
  const family = isIP(ip)
  if (family === 0) return true
  return BLOCKED.check(ip, family === 4 ? "ipv4" : "ipv6")
}

async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Seules les URL http(s) sont acceptées.")
  if (process.env.ALLOW_PRIVATE_FETCH === "true") return
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Adresse interne refusée.")
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Adresse interne refusée.")
}

export async function safeFetchText(rawUrl: string, opts: { timeoutMs?: number; maxBytes?: number } = {}) {
  const { timeoutMs = 10_000, maxBytes = 1_000_000 } = opts
  let url = new URL(rawUrl)
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "AfriContextBot/1.0 (+veille des documentations)", Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) return { url: url.toString(), text: "" }
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    return { url: url.toString(), text: Buffer.concat(chunks).toString("utf8") }
  }
  throw new Error("Trop de redirections.")
}

/** Texte lisible d'une page HTML (scripts, styles et balises retirés). */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}
