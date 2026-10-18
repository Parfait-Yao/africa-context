import { checkSections, contextSubmissionSchema } from "./spec.schema"
import { scanForSecrets } from "./secret-scanner"

/**
 * Rapport de validation technique d'un contexte déjà enregistré (back-office).
 * Module pur : il réutilise les règles de l'AfriContext Spec (champs, sections, secrets)
 * et ajoute des contrôles de forme (blocs de code, version d'API, source).
 * Il n'exécute rien : aucun appel d'API ni exemple de code n'est testé ici.
 */

export type CheckLevel = "ok" | "warning" | "error" | "info"

export interface Check {
  key: string
  label: string
  level: CheckLevel
  details: string[]
  /** Bloque l'approbation côté serveur (contextService.moderate). */
  blocking?: boolean
}

export interface CheckableContext {
  slug: string
  title: string
  description: string
  type: string
  service: string
  category: string
  countries: string[]
  apiVersion: string
  sourceUrl: string
  testedWith: string[]
  tags: string[]
  content: string
  /** Veille de la source (F12), si connue. */
  sourceCheckedAt?: string | null
  sourceCheckFailures?: number
  proofs?: { sandboxResult?: "passed" | "failed" }[]
}

const FIELD_LABELS: Record<string, string> = {
  slug: "Slug",
  title: "Titre",
  description: "Description",
  type: "Type",
  service: "Service",
  category: "Catégorie",
  pays: "Pays",
  version_api: "Version d'API",
  source_url: "URL source",
  tested_with: "Outils testés",
  tags: "Tags",
  content: "Contenu",
}

/** Blocs de code Markdown : nombre, langages déclarés, bloc non refermé. */
export function analyzeCodeBlocks(markdown: string) {
  const fences = Array.from(markdown.matchAll(/^\s*(`{3,}|~{3,})(.*)$/gm))
  const blocks: { lang: string; empty: boolean }[] = []
  let open: { lang: string; start: number } | null = null
  for (const f of fences) {
    if (!open) {
      open = { lang: f[2].trim(), start: (f.index ?? 0) + f[0].length }
    } else {
      const body = markdown.slice(open.start, f.index ?? 0)
      blocks.push({ lang: open.lang, empty: body.trim().length === 0 })
      open = null
    }
  }
  return { blocks, unclosed: open !== null }
}

const VERSION_PATTERN = /^(v?\d+(\.\d+)*[a-z0-9.-]*|\d{4}-\d{2}(-\d{2})?)$/i

export function runContextChecks(c: CheckableContext): Check[] {
  const checks: Check[] = []

  // 1. Champs obligatoires de la Spec
  const parsed = contextSubmissionSchema.safeParse({
    slug: c.slug,
    title: c.title,
    description: c.description,
    type: c.type,
    service: c.service,
    category: c.category,
    pays: c.countries,
    version_api: c.apiVersion,
    source_url: c.sourceUrl,
    tested_with: c.testedWith,
    tags: c.tags,
    content: c.content,
  })
  const fieldErrors = parsed.success ? {} : (parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>)
  const fieldDetails = Object.entries(fieldErrors).flatMap(([k, msgs]) => (msgs ?? []).map((m) => `${FIELD_LABELS[k] ?? k} : ${m}`))
  checks.push({ key: "fields", label: "Champs obligatoires", level: fieldDetails.length ? "error" : "ok", details: fieldDetails })

  // 2. Structure : les 8 sections de la Spec
  const { missing, present } = checkSections(c.content)
  checks.push({
    key: "sections",
    label: `Structure (${present.length}/${present.length + missing.length} sections)`,
    level: missing.length ? "error" : "ok",
    details: missing.map((m) => `Section manquante : ${m.title}`),
    blocking: true,
  })

  // 3. Secrets (contenu et métadonnées)
  const secrets = scanForSecrets([c.content, c.description, c.sourceUrl].join("\n"))
  checks.push({
    key: "secrets",
    label: "Secrets",
    level: secrets.length ? "error" : "ok",
    details: secrets.map((s) => `Ligne ${s.line} : ${s.label} (${s.excerpt})`),
    blocking: true,
  })

  // 4. Exemples de code (forme uniquement : rien n'est exécuté)
  const { blocks, unclosed } = analyzeCodeBlocks(c.content)
  const codeDetails: string[] = []
  if (blocks.length === 0) codeDetails.push("Aucun bloc de code : l'« Exemple minimal complet » devrait en contenir un.")
  if (unclosed) codeDetails.push("Un bloc de code n'est pas refermé (``` manquant).")
  const noLang = blocks.filter((b) => !b.lang).length
  if (noLang) codeDetails.push(`${noLang} bloc(s) sans langage déclaré (ex. \`\`\`ts).`)
  const empty = blocks.filter((b) => b.empty).length
  if (empty) codeDetails.push(`${empty} bloc(s) vide(s).`)
  checks.push({
    key: "code",
    label: `Exemples de code (${blocks.length} bloc${blocks.length > 1 ? "s" : ""})`,
    level: blocks.length === 0 || unclosed ? "error" : codeDetails.length ? "warning" : "ok",
    details: codeDetails,
  })

  // 5. Version d'API
  const version = c.apiVersion.trim()
  checks.push({
    key: "version",
    label: "Version d'API",
    level: !version ? "error" : VERSION_PATTERN.test(version) ? "ok" : "warning",
    details: !version ? ["Version absente."] : VERSION_PATTERN.test(version) ? [] : [`Format inhabituel : « ${version} » (attendu : v1, 2.0, 2024-06…).`],
  })

  // 6. Source documentaire
  const sourceDetails: string[] = []
  let sourceLevel: CheckLevel = "ok"
  if (!c.sourceUrl.startsWith("https://")) {
    sourceLevel = "error"
    sourceDetails.push("L'URL source doit être en HTTPS.")
  }
  if ((c.sourceCheckFailures ?? 0) > 0) {
    sourceLevel = sourceLevel === "error" ? "error" : "warning"
    sourceDetails.push(`Source injoignable lors des ${c.sourceCheckFailures} dernière(s) vérification(s) automatique(s).`)
  } else if (c.sourceCheckedAt === null) {
    sourceDetails.push("La veille automatique n'a pas encore vérifié cette source.")
  }
  checks.push({ key: "source", label: "Source documentaire", level: sourceLevel, details: sourceDetails })

  // 7. Tests réellement enregistrés (preuves) — distinct des outils déclarés par le contributeur
  const proofs = c.proofs ?? []
  const passed = proofs.filter((p) => p.sandboxResult === "passed").length
  const failed = proofs.filter((p) => p.sandboxResult === "failed").length
  const testDetails = [
    proofs.length === 0
      ? "Aucune preuve ni exécution enregistrée : le contenu n'a pas été testé par AfriContext."
      : `${proofs.length} preuve(s) avant / après, ${passed} exécution(s) sandbox réussie(s), ${failed} échouée(s).`,
  ]
  if (c.testedWith.length) testDetails.push(`Outils déclarés par le contributeur (non vérifiés) : ${c.testedWith.join(", ")}.`)
  checks.push({ key: "tests", label: "Tests", level: failed ? "warning" : passed ? "ok" : "info", details: testDetails })

  return checks
}

export function summarizeChecks(checks: Check[]) {
  return {
    errors: checks.filter((c) => c.level === "error").length,
    warnings: checks.filter((c) => c.level === "warning").length,
    blocking: checks.some((c) => c.blocking && c.level === "error"),
  }
}
