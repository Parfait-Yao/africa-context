/**
 * Détection des URL suspectes et des caractères invisibles dans un contenu.
 * Module pur : règles heuristiques, donc faux positifs et oublis possibles.
 * Les résultats sont des alertes à examiner, jamais une garantie de sécurité.
 */

export type FindingSeverity = "high" | "medium" | "low"

export interface ContentFinding {
  rule: string
  label: string
  severity: FindingSeverity
  line: number
  /** Extrait expurgé : identifiants et valeurs de paramètres sensibles masqués. */
  excerpt: string
}

/** Domaines de documentation et d'exemple : http, IP et ports y sont normaux (sandbox locale, RFC 2606). */
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal)$|\.(example|test|local|localhost|invalid)$|(^|\.)example\.(com|org|net)$/i

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "ow.ly", "rebrand.ly", "shorturl.at", "buff.ly", "tiny.cc", "rb.gy", "s.id",
])

const SENSITIVE_PARAM = /^(token|access_token|api_?key|apikey|key|secret|client_secret|password|pwd|signature|sig|auth)$/i

// URL http(s) ; s'arrête aux délimiteurs Markdown et guillemets
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`)\]}]+/gi
const SCHEME_PATTERN = /\b(javascript|vbscript):[^\s"'`)]*|\bdata:text\/html[^\s"'`)]*/gi

/** Caractères bidirectionnels (attaque « Trojan Source ») et caractères de largeur nulle. */
const BIDI = /[‪-‮⁦-⁩]/
const ZERO_WIDTH = /[​-‍⁠﻿]/
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/

const truncate = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** URL lisible pour l'interface : identifiants et paramètres sensibles masqués. */
export function redactUrl(raw: string) {
  try {
    const u = new URL(raw)
    if (u.username || u.password) {
      u.username = "••••"
      u.password = ""
    }
    for (const [k] of [...u.searchParams]) if (SENSITIVE_PARAM.test(k)) u.searchParams.set(k, "••••")
    return truncate(decodeURI(u.toString()))
  } catch {
    return truncate(raw.replace(/\/\/[^/@\s]+@/, "//••••@"))
  }
}

function isIpHost(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")
}

function checkUrl(raw: string): Omit<ContentFinding, "line" | "excerpt">[] {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return [{ rule: "url-invalid", label: "URL malformée", severity: "low" }]
  }
  const host = u.hostname.toLowerCase()
  const local = LOCAL_HOST.test(host)
  const out: Omit<ContentFinding, "line" | "excerpt">[] = []

  if (u.username || u.password) out.push({ rule: "url-credentials", label: "Identifiants inclus dans l'URL", severity: "high" })
  if ([...u.searchParams].some(([k, v]) => SENSITIVE_PARAM.test(k) && v.length >= 8 && !/^(<|\$\{|\{\{|YOUR_|VOTRE_)/.test(v))) {
    out.push({ rule: "url-token-param", label: "Jeton ou clé passé en paramètre d'URL", severity: "high" })
  }
  if (host.split(".").some((part) => part.startsWith("xn--"))) out.push({ rule: "url-punycode", label: "Nom de domaine internationalisé (punycode), risque d'homographe", severity: "medium" })
  if (SHORTENERS.has(host)) out.push({ rule: "url-shortener", label: "Lien raccourci : destination réelle masquée", severity: "medium" })
  if (!local) {
    if (isIpHost(host)) out.push({ rule: "url-ip-host", label: "Adresse IP à la place d'un nom de domaine", severity: "medium" })
    if (u.protocol === "http:") out.push({ rule: "url-insecure", label: "Lien non chiffré (http)", severity: "low" })
    if (u.port && !["80", "443"].includes(u.port)) out.push({ rule: "url-port", label: `Port inhabituel (${u.port})`, severity: "low" })
  }
  return out
}

export function scanUrls(text: string): ContentFinding[] {
  const findings: ContentFinding[] = []
  text.split(/\r?\n/).forEach((lineText, i) => {
    for (const m of lineText.matchAll(URL_PATTERN)) {
      const raw = m[0].replace(/[.,;:!?]+$/, "")
      for (const f of checkUrl(raw)) findings.push({ ...f, line: i + 1, excerpt: redactUrl(raw) })
    }
    for (const m of lineText.matchAll(SCHEME_PATTERN)) {
      findings.push({ rule: "url-dangerous-scheme", label: "Schéma exécutable (javascript:, data:text/html…)", severity: "high", line: i + 1, excerpt: truncate(m[0], 40) })
    }
  })
  return findings
}

/** Caractères invisibles : peuvent faire lire à un humain un code différent de celui exécuté. */
export function scanHiddenCharacters(text: string): ContentFinding[] {
  const findings: ContentFinding[] = []
  text.split(/\r?\n/).forEach((lineText, i) => {
    const visible = (s: string) => truncate(s.replace(/[‪-‮⁦-⁩​-‍⁠﻿\u0000-\u001F]/g, "⍰").trim(), 60)
    if (BIDI.test(lineText)) findings.push({ rule: "hidden-bidi", label: "Caractère de contrôle bidirectionnel (Trojan Source)", severity: "high", line: i + 1, excerpt: visible(lineText) })
    if (ZERO_WIDTH.test(lineText.replace(/^﻿/, ""))) findings.push({ rule: "hidden-zero-width", label: "Caractère de largeur nulle", severity: "medium", line: i + 1, excerpt: visible(lineText) })
    if (CONTROL.test(lineText)) findings.push({ rule: "hidden-control", label: "Caractère de contrôle (contenu binaire ou corrompu)", severity: "medium", line: i + 1, excerpt: visible(lineText) })
  })
  return findings
}
