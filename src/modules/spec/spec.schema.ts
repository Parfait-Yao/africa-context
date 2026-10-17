import { z } from "zod"
import { AI_TOOLS, CONTEXT_TYPES } from "@/modules/contexts/context.types"
import { scanForSecrets, type SecretFinding } from "./secret-scanner"

/**
 * AfriContext Spec — format standard (cahier des charges §6).
 * Ce module est pur (pas d'accès réseau ni disque) : il est partagé entre
 * le formulaire (validation instantanée) et l'API (validation qui fait foi).
 */

export const REQUIRED_SECTIONS = [
  { key: "auth", title: "Authentification", match: ["authentification", "auth"] },
  { key: "endpoints", title: "Endpoints utilisés", match: ["endpoint"] },
  { key: "errors", title: "Erreurs", match: ["erreur"] },
  { key: "webhooks", title: "Webhooks", match: ["webhook"] },
  { key: "limits", title: "Idempotence et limites de débit", match: ["idempotence", "limite"] },
  { key: "pitfalls", title: "Pièges courants", match: ["piège", "piege"] },
  { key: "example", title: "Exemple minimal complet", match: ["exemple"] },
  { key: "env", title: "Variables d'environnement", match: ["variable", "environnement"] },
] as const

export type SectionKey = (typeof REQUIRED_SECTIONS)[number]["key"]

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const specFrontmatterSchema = z.object({
  slug: z
    .string()
    .min(3, "Le slug doit faire au moins 3 caractères.")
    .max(80)
    .regex(slugRegex, "Le slug ne contient que des minuscules, chiffres et tirets (ex. wave-checkout-api)."),
  title: z.string().min(5, "Le titre doit faire au moins 5 caractères.").max(120),
  description: z.string().min(20, "Décrivez le contexte en au moins 20 caractères.").max(300),
  type: z.enum(CONTEXT_TYPES, {
    errorMap: () => ({ message: "Le type doit être cursorrules, claude_prompt ou mcp_server." }),
  }),
  service: z.string().min(2, "Indiquez le service (ex. Wave)."),
  category: z.string().min(2, "Choisissez une catégorie."),
  pays: z.array(z.string().length(2)).min(1, "Sélectionnez au moins un pays."),
  version_api: z.string().min(1, "Indiquez la version de l'API (ex. v1)."),
  source_url: z
    .string()
    .url("L'URL de la documentation officielle est obligatoire et doit être valide.")
    .refine((u) => u.startsWith("https://"), "L'URL source doit être en HTTPS."),
  tested_with: z.array(z.enum(AI_TOOLS)).default([]),
  tags: z.array(z.string().min(2).max(30)).max(8, "8 tags maximum.").default([]),
})

export type SpecFrontmatter = z.infer<typeof specFrontmatterSchema>

export const contextSubmissionSchema = specFrontmatterSchema.extend({
  content: z.string().min(200, "Le contenu doit faire au moins 200 caractères."),
})

export type ContextSubmission = z.infer<typeof contextSubmissionSchema>

export interface SpecReport {
  valid: boolean
  fieldErrors: Record<string, string[]>
  missingSections: { key: SectionKey; title: string }[]
  presentSections: SectionKey[]
  secrets: SecretFinding[]
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Repère les titres `## …` du corps et vérifie que les 8 sections obligatoires sont présentes. */
export function checkSections(markdown: string) {
  const headings = Array.from(markdown.matchAll(/^#{2,3}\s+(.+)$/gm)).map((m) => normalize(m[1]))
  const present: SectionKey[] = []
  const missing: { key: SectionKey; title: string }[] = []

  for (const section of REQUIRED_SECTIONS) {
    const found = headings.some((h) => section.match.some((word) => h.includes(normalize(word))))
    if (found) present.push(section.key)
    else missing.push({ key: section.key, title: section.title })
  }
  return { present, missing }
}

/** Validation complète d'une soumission : champs, sections et secrets. */
export function validateSubmission(input: unknown): SpecReport & { data?: ContextSubmission } {
  const parsed = contextSubmissionSchema.safeParse(input)
  const content = typeof (input as { content?: unknown })?.content === "string" ? (input as { content: string }).content : ""
  const { present, missing } = checkSections(content)
  const secrets = scanForSecrets(JSON.stringify(input ?? {}).replace(/\\n/g, "\n"))

  const fieldErrors = parsed.success ? {} : (parsed.error.flatten().fieldErrors as Record<string, string[]>)

  return {
    valid: parsed.success && missing.length === 0 && secrets.length === 0,
    fieldErrors,
    missingSections: missing,
    presentSections: present,
    secrets,
    data: parsed.success ? parsed.data : undefined,
  }
}

/** Gabarit de départ proposé dans le formulaire. */
export const SPEC_BODY_TEMPLATE = `## Authentification
Méthode et en-têtes, sans aucune valeur secrète (ex. \`Authorization: Bearer $SERVICE_API_KEY\`).

## Endpoints utilisés
| Méthode | Chemin | Champs requis | Champs optionnels |
|---|---|---|---|
| POST | /v1/... | ... | ... |

## Erreurs
Codes HTTP et codes métier, avec le comportement attendu.

## Webhooks
Format du payload et vérification de la signature.

## Idempotence et limites de débit
Clé d'idempotence, quotas, stratégie de retry.

## Pièges courants
Ce que les LLMs inventent le plus souvent pour ce service.

## Exemple minimal complet
\`\`\`ts
// Exemple typé, sans secret
\`\`\`

## Variables d'environnement
- \`SERVICE_API_KEY\`
`
