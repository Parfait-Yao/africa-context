import type { Context, ExportFormat } from "./context.types"

/**
 * Exports par outil (F7) — utilisés par l'endpoint /api/contexts/[slug]/raw
 * et par la CLI `npx africontext add <slug> --format <format>`.
 */

export const FORMAT_META: Record<
  ExportFormat,
  { label: string; fileName: string; description: string }
> = {
  raw: { label: "Markdown brut", fileName: "<slug>.md", description: "Le contexte complet avec son en-tête Spec." },
  cursorrules: { label: "Cursor", fileName: ".cursor/rules/<slug>.mdc", description: "Règle Cursor chargée automatiquement." },
  claude: { label: "Claude Code", fileName: "CLAUDE.md", description: "Ajouté à la fin du CLAUDE.md du projet." },
  agents: { label: "AGENTS.md", fileName: "AGENTS.md", description: "Format ouvert lu par la plupart des agents." },
}

export function targetFileName(format: ExportFormat, slug: string) {
  return FORMAT_META[format].fileName.replace("<slug>", slug)
}

function frontmatter(ctx: Context) {
  return [
    "---",
    `slug: ${ctx.slug}`,
    `title: ${ctx.title}`,
    `type: ${ctx.type}`,
    `service: ${ctx.service}`,
    `pays: [${ctx.countries.join(", ")}]`,
    `version_api: ${ctx.apiVersion}`,
    `source_url: ${ctx.sourceUrl}`,
    `tested_with: [${ctx.testedWith.join(", ")}]`,
    `last_verified_at: ${ctx.lastVerifiedAt.slice(0, 10)}`,
    `tags: [${ctx.tags.join(", ")}]`,
    "---",
  ].join("\n")
}

export function renderContext(ctx: Context, format: ExportFormat): string {
  const header = `# ${ctx.title}\n\n> Contexte AfriContext · ${ctx.service} ${ctx.apiVersion} · vérifié le ${ctx.lastVerifiedAt.slice(0, 10)}\n> Source officielle : ${ctx.sourceUrl}\n`

  switch (format) {
    case "raw":
      return `${frontmatter(ctx)}\n\n${ctx.content.trim()}\n`
    case "cursorrules":
      return [
        "---",
        `description: ${ctx.description}`,
        "globs:",
        "alwaysApply: false",
        "---",
        "",
        header,
        ctx.content.trim(),
        "",
      ].join("\n")
    case "claude":
    case "agents":
      return [
        `<!-- africontext:${ctx.slug}:start -->`,
        header,
        ctx.content.trim(),
        `<!-- africontext:${ctx.slug}:end -->`,
        "",
      ].join("\n")
  }
}

/** Temps gagné estimé (F16) : hypothèse de 25 minutes par installation, affichée comme telle. */
export const MINUTES_SAVED_PER_INSTALL = 25
