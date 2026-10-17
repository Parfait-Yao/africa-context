import { parse as parseYaml } from "yaml"

/**
 * Convertit un fichier .md AfriContext (front matter YAML + corps) en objet de soumission.
 * La validation reste faite par validateSubmission() : ce module ne fait que traduire.
 */
function splitFrontMatter(markdown: string) {
  const m = markdown.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {} as Record<string, unknown>, content: markdown }
  const data = parseYaml(m[1], { maxAliasCount: 0 }) ?? {}
  if (typeof data !== "object" || Array.isArray(data)) throw new Error("En-tête YAML invalide.")
  return { data: data as Record<string, unknown>, content: m[2] }
}

export function parseSpecMarkdown(markdown: string) {
  const { data, content } = splitFrontMatter(markdown)
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])
  return {
    slug: data.slug as string | undefined,
    title: data.title,
    description: data.description ?? "",
    type: data.type,
    service: data.service,
    category: data.category ?? "",
    pays: list(data.pays),
    version_api: data.version_api != null ? String(data.version_api) : undefined,
    source_url: data.source_url,
    tested_with: list(data.tested_with),
    tags: list(data.tags),
    content: content.trim(),
  }
}
