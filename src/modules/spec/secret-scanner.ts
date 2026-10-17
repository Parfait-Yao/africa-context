/**
 * Scanner de secrets (F6).
 * Module pur, sans dépendance : il tourne côté serveur (contrôle qui fait foi)
 * et côté client (retour immédiat dans le formulaire de soumission).
 */

export interface SecretFinding {
  rule: string
  label: string
  line: number
  excerpt: string
}

interface Rule {
  id: string
  label: string
  pattern: RegExp
}

const RULES: Rule[] = [
  { id: "stripe-like", label: "Clé secrète de type sk_live / sk_test", pattern: /\bsk_(live|test)_[A-Za-z0-9]{8,}/g },
  { id: "wave-key", label: "Clé API Wave", pattern: /\bwave_(sn|ci|ml|bf|ug|gm)_prod_[A-Za-z0-9_-]{8,}/gi },
  { id: "fedapay-key", label: "Clé FedaPay", pattern: /\b(sk|pk)_(live|sandbox)_[A-Za-z0-9_-]{16,}/g },
  { id: "paystack-key", label: "Clé Paystack", pattern: /\b(sk|pk)_(live|test)_[a-f0-9]{30,}/g },
  { id: "flutterwave-key", label: "Clé Flutterwave", pattern: /\bFLW(SECK|PUBK)(_TEST)?-[A-Za-z0-9]{20,}(-X)?/g },
  { id: "basic-auth", label: "En-tête Basic en clair (Orange, MTN…)", pattern: /Basic\s+(?!<|\$\{|\{\{|process\.env|YOUR_|VOTRE_)[A-Za-z0-9+/]{20,}={0,2}/g },
  { id: "subscription-key", label: "Clé d'abonnement (Ocp-Apim-Subscription-Key)", pattern: /Ocp-Apim-Subscription-Key["']?\s*[:=]\s*["']?[a-f0-9]{32}/gi },
  { id: "bearer", label: "Jeton Bearer en clair", pattern: /Bearer\s+(?!<|\$\{|\{\{|process\.env|YOUR_|VOTRE_)[A-Za-z0-9._~+/=-]{16,}/g },
  { id: "aws", label: "Clé d'accès AWS", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "github", label: "Jeton GitHub", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { id: "private-key", label: "Clé privée", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    id: "assignment",
    label: "Valeur secrète affectée à une variable",
    pattern: /\b(api[_-]?key|secret|token|password|passwd|client_secret)\s*[:=]\s*["'](?!<|\$\{|\{\{|YOUR_|VOTRE_|xxx)[A-Za-z0-9._~+/=-]{12,}["']/gi,
  },
  { id: "long-hex", label: "Longue chaîne hexadécimale (clé probable)", pattern: /\b[a-f0-9]{40,}\b/gi },
]

export function scanForSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = []
  const lines = text.split(/\r?\n/)

  lines.forEach((lineText, index) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0
      const match = rule.pattern.exec(lineText)
      if (match) {
        findings.push({
          rule: rule.id,
          label: rule.label,
          line: index + 1,
          excerpt: maskSecret(match[0]),
        })
      }
    }
  })

  return findings
}

function maskSecret(value: string) {
  if (value.length <= 8) return "••••"
  return `${value.slice(0, 6)}…${"•".repeat(4)}`
}
