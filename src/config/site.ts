export const siteConfig = {
  name: "AfriContext",
  tagline: "Des contextes vérifiés pour que votre IA intègre les services africains du premier coup.",
  description:
    "Bibliothèque communautaire de contextes IA vérifiés pour Wave, Orange Money, FedaPay, MTN MoMo, les API SMS et d'autres services africains. Installables en une commande dans Cursor, Claude Code ou tout assistant compatible.",
  // Sur Vercel, VERCEL_PROJECT_PRODUCTION_URL (fourni automatiquement) sert de repli si NEXT_PUBLIC_APP_URL est absente
  url:
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  cliPackage: "africontext",
  github: "https://github.com/",
  event: "CADEV 2026 · Systalink Challenge",
  team: "Impaact code",
}

export const mainNav = [
  { title: "Catalogue", href: "/contexts" },
  { title: "Contribuer", href: "/submit" },
  { title: "CLI & formats", href: "/docs" },
] as const

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" },
  { code: "CM", name: "Cameroun" },
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Ouganda" },
  { code: "RW", name: "Rwanda" },
]

export const CATEGORIES = [
  { value: "paiement-mobile", label: "Paiement mobile" },
  { value: "agregateur", label: "Agrégateur de paiement" },
  { value: "sms", label: "SMS & messagerie" },
] as const

export const CONTEXT_TYPE_LABELS = {
  cursorrules: ".cursorrules",
  claude_prompt: "Prompt Claude",
  mcp_server: "Serveur MCP",
} as const

export const STATUS_LABELS = {
  pending: "En attente",
  approved: "Vérifié",
  rejected: "Rejeté",
  to_recheck: "À revérifier",
} as const

export const REPORT_REASON_LABELS: Record<string, string> = {
  obsolete: "Obsolète",
  incorrect: "Incorrect",
  dangerous: "Dangereux",
  secret: "Contient un secret",
  other: "Autre",
}

export const REPORT_STATUS_LABELS = {
  open: "Ouvert",
  resolved: "Traité",
  dismissed: "Classé sans suite",
} as const

export const TOOL_LABELS = {
  cursor: "Cursor",
  "claude-code": "Claude Code",
  copilot: "GitHub Copilot",
  windsurf: "Windsurf",
} as const

export function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}
