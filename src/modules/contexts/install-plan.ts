import type { Context } from "./context.types"

/**
 * Plan d'installation en une commande (`npx africontext add <slug> --env <outil>`).
 * Module pur : à partir d'un contexte publié, de l'outil IA choisi et du framework détecté par la CLI,
 * il décrit tous les fichiers à écrire pour que l'agent puisse travailler immédiatement :
 * règles de l'agent (avec la configuration du projet), variables d'environnement à remplir,
 * protection du fichier .env dans .gitignore. La CLI applique ce plan sans rien inventer.
 */

export const INSTALL_ENVS = {
  cursor: { label: "Cursor", hint: "Règle .cursor/rules, appliquée automatiquement" },
  claude: { label: "Claude Code", hint: "Bloc ajouté au CLAUDE.md du projet" },
  windsurf: { label: "Windsurf", hint: "Règle .windsurf/rules, toujours active" },
  copilot: { label: "GitHub Copilot", hint: "Instructions .github/instructions (VS Code)" },
  agents: { label: "Autre agent (AGENTS.md)", hint: "Codex, Gemini CLI, Jules, Aider…" },
} as const
export type InstallEnv = keyof typeof INSTALL_ENVS
export const INSTALL_ENV_KEYS = Object.keys(INSTALL_ENVS) as InstallEnv[]

/** Fichiers de règles écrits pour chaque outil (affichés sur le site, écrits par le plan). */
export function ruleFilePaths(env: InstallEnv, slug: string): string[] {
  return {
    cursor: [`.cursor/rules/${slug}.mdc`],
    claude: ["CLAUDE.md"],
    windsurf: [`.windsurf/rules/${slug}.md`, `africontext/${slug}.md`],
    copilot: [`.github/instructions/${slug}.instructions.md`],
    agents: ["AGENTS.md"],
  }[env]
}

export const STACKS = ["next", "nuxt", "sveltekit", "remix", "nest", "express", "fastify", "vite", "node", "python", "unknown"] as const
export type Stack = (typeof STACKS)[number]

const STACK_INFO: Record<Stack, { label: string; envFile: string; guidance: string[] }> = {
  next: {
    label: "Next.js",
    envFile: ".env.local",
    guidance: [
      "Appelle l'API uniquement côté serveur : Route Handlers (`app/api/**/route.ts`) ou Server Actions, jamais dans un composant client.",
      "Place la réception des notifications / webhooks dans un Route Handler dédié, par exemple `app/api/<service>/webhook/route.ts`.",
      "Lis les variables avec `process.env.NOM` côté serveur ; ne les préfixe jamais par `NEXT_PUBLIC_`.",
    ],
  },
  nuxt: {
    label: "Nuxt",
    envFile: ".env",
    guidance: [
      "Appelle l'API dans `server/api/**` ; expose les clés via `runtimeConfig` (partie privée, jamais `public`).",
      "Place le webhook dans une route serveur dédiée, par exemple `server/api/<service>/webhook.post.ts`.",
    ],
  },
  sveltekit: {
    label: "SvelteKit",
    envFile: ".env",
    guidance: [
      "Appelle l'API dans des fichiers serveur (`+server.ts`, `+page.server.ts`) ; lis les clés via `$env/static/private`.",
      "Place le webhook dans une route `+server.ts` dédiée.",
    ],
  },
  remix: {
    label: "Remix / React Router",
    envFile: ".env",
    guidance: ["Appelle l'API dans les `loader` / `action` (serveur) ; le webhook est une route ressource avec une `action`."],
  },
  nest: {
    label: "NestJS",
    envFile: ".env",
    guidance: [
      "Crée un module dédié (service + contrôleur) ; lis les clés via `ConfigService`.",
      "Le webhook est une route POST du contrôleur ; garde le corps brut si une signature doit être vérifiée.",
    ],
  },
  express: {
    label: "Express",
    envFile: ".env",
    guidance: [
      "Charge `.env` au démarrage (`dotenv` ou `node --env-file=.env`).",
      "Le webhook est une route POST dédiée ; garde le corps brut (`express.raw`) si une signature doit être vérifiée.",
    ],
  },
  fastify: {
    label: "Fastify",
    envFile: ".env",
    guidance: [
      "Charge `.env` au démarrage (`@fastify/env`, `dotenv` ou `node --env-file=.env`).",
      "Le webhook est une route POST dédiée ; conserve le corps brut si une signature doit être vérifiée.",
    ],
  },
  vite: {
    label: "Application front-end (Vite)",
    envFile: ".env.local",
    guidance: [
      "Ce projet tourne dans le navigateur : n'appelle JAMAIS cette API depuis le front, toute clé y serait visible.",
      "Crée d'abord un petit backend (fonction serverless ou serveur Node) qui détient les clés et appelle l'API ; ne préfixe jamais ces variables par `VITE_`.",
    ],
  },
  node: {
    label: "Node.js",
    envFile: ".env",
    guidance: ["Charge `.env` au démarrage (`dotenv` ou `node --env-file=.env`) ; l'API ne s'appelle que côté serveur."],
  },
  python: {
    label: "Python",
    envFile: ".env",
    guidance: [
      "Lis les clés avec `os.environ` (chargées par `python-dotenv` si besoin).",
      "Adapte l'exemple TypeScript ci-dessous en Python (requests / httpx) sans changer les endpoints ni les champs.",
    ],
  },
  unknown: {
    label: "Projet",
    envFile: ".env",
    guidance: ["Les appels à l'API et les clés restent côté serveur, jamais dans le navigateur ni dans une application mobile."],
  },
}

export interface EnvVar {
  name: string
  description?: string
}

/**
 * Variables listées dans la section « Variables d'environnement » de la Spec :
 * lignes « - `NOM` » éventuellement suivies d'une description (« — », « : » ou « - »).
 */
export function extractEnvVars(content: string): EnvVar[] {
  const section = content.split(/^##\s+/m).find((s) => /^variables?\s+d.environnement/i.test(s))
  if (!section) return []
  const vars: EnvVar[] = []
  for (const line of section.split(/\r?\n/).slice(1)) {
    const m = line.match(/^\s*[-*]\s+`?([A-Z][A-Z0-9_]{1,63})`?\s*(?:[—:–-]\s*(.+))?$/)
    if (m && !vars.some((v) => v.name === m[1])) vars.push({ name: m[1], description: m[2]?.trim() || undefined })
  }
  return vars
}

export type PlanFile =
  /** Fichier appartenant à AfriContext : créé ou remplacé (marqueur « africontext » attendu dans l'existant). */
  | { kind: "file"; path: string; content: string }
  /** Bloc délimité par des marqueurs dans un fichier partagé (CLAUDE.md, AGENTS.md). */
  | { kind: "block"; path: string; content: string; start: string; end: string }
  /** Variables ajoutées si absentes, sans valeur : l'utilisateur les remplit. */
  | { kind: "env"; path: string; header: string; vars: EnvVar[] }
  /** Lignes ajoutées si absentes (.gitignore). */
  | { kind: "lines"; path: string; lines: string[] }

export interface InstallPlan {
  slug: string
  title: string
  service: string
  apiVersion: string
  verifiedAt: string
  status: string
  sourceUrl: string
  env: InstallEnv
  stack: Stack
  stackLabel: string
  envFile: string
  envVars: EnvVar[]
  files: PlanFile[]
  /** Phrase à dire à l'agent après l'installation. */
  suggestedRequest: string
  warnings: string[]
}

/** Section ajoutée en tête des règles : ce que l'agent doit savoir sur ce projet précis. */
function projectSection(ctx: Context, stack: Stack, envFile: string, vars: EnvVar[]) {
  const info = STACK_INFO[stack]
  return [
    "## Configuration de ce projet (générée par AfriContext)",
    "",
    `- Projet détecté : **${info.label}**.`,
    ...info.guidance.map((g) => `- ${g}`),
    vars.length
      ? `- Variables déjà déclarées (vides) dans \`${envFile}\` et documentées dans \`.env.example\` : ${vars.map((v) => `\`${v.name}\``).join(", ")}. Utilise exactement ces noms ; si une valeur manque, demande à l'utilisateur de la renseigner dans \`${envFile}\` au lieu de l'inventer.`
      : `- Les clés se lisent depuis \`${envFile}\` (déjà ignoré par git).`,
    "- N'écris jamais une clé, un jeton ou un mot de passe en dur dans le code, les tests ou les commits.",
    `- Respecte strictement les endpoints, champs et règles ci-dessous (${ctx.service} ${ctx.apiVersion}). En cas de doute, la source officielle fait foi : ${ctx.sourceUrl}`,
    "",
  ].join("\n")
}

function header(ctx: Context) {
  return [
    `# ${ctx.title}`,
    "",
    `> Contexte AfriContext · ${ctx.service} ${ctx.apiVersion} · vérifié le ${ctx.lastVerifiedAt.slice(0, 10)}`,
    `> Source officielle : ${ctx.sourceUrl}`,
    ...(ctx.status === "to_recheck"
      ? [`> ⚠️ Ce contexte est marqué « à revérifier » : la documentation a pu changer, contrôle la source officielle avant de livrer.`]
      : []),
    "",
  ].join("\n")
}

export function buildInstallPlan(ctx: Context, env: InstallEnv, stack: Stack): InstallPlan {
  const info = STACK_INFO[stack]
  const envVars = extractEnvVars(ctx.content)
  const rules = [header(ctx), projectSection(ctx, stack, info.envFile, envVars), ctx.content.trim(), ""].join("\n")
  const start = `<!-- africontext:${ctx.slug}:start -->`
  const end = `<!-- africontext:${ctx.slug}:end -->`
  const block = [start, rules.trimEnd(), end, ""].join("\n")
  const description = ctx.description.replace(/\s+/g, " ").replace(/"/g, "'")

  const ruleFiles: PlanFile[] = {
    cursor: [
      {
        kind: "file" as const,
        path: `.cursor/rules/${ctx.slug}.mdc`,
        content: ["---", `description: "${description}"`, "globs:", "alwaysApply: true", "---", "", rules].join("\n"),
      },
    ],
    claude: [{ kind: "block" as const, path: "CLAUDE.md", content: block, start, end }],
    agents: [{ kind: "block" as const, path: "AGENTS.md", content: block, start, end }],
    copilot: [
      {
        kind: "file" as const,
        path: `.github/instructions/${ctx.slug}.instructions.md`,
        content: ["---", 'applyTo: "**"', `description: "${description}"`, "---", "", rules].join("\n"),
      },
    ],
    // Windsurf limite la taille d'une règle : la règle toujours active pointe vers le contexte complet
    windsurf: [
      { kind: "file" as const, path: `africontext/${ctx.slug}.md`, content: rules },
      {
        kind: "file" as const,
        path: `.windsurf/rules/${ctx.slug}.md`,
        content: [
          "---",
          "trigger: always_on",
          "---",
          "",
          `# ${ctx.title} (AfriContext)`,
          "",
          `Avant d'écrire ou de modifier du code lié à ${ctx.service}, lis entièrement \`africontext/${ctx.slug}.md\` et respecte-le : endpoints, champs, authentification, webhooks et pièges y sont vérifiés.`,
          `Variables à utiliser (dans \`${info.envFile}\`) : ${envVars.map((v) => `\`${v.name}\``).join(", ") || "voir le fichier"}. Jamais de clé en dur.`,
          "",
        ].join("\n"),
      },
    ],
  }[env]

  const files: PlanFile[] = [...ruleFiles]
  if (envVars.length) {
    const head = `${ctx.title} (${ctx.slug}) — ajouté par AfriContext`
    files.push(
      { kind: "env", path: ".env.example", header: `${head}. Modèle sans valeurs, à committer.`, vars: envVars },
      { kind: "env", path: info.envFile, header: `${head}. Renseignez les valeurs ; ce fichier ne doit jamais être commité.`, vars: envVars }
    )
  }
  files.push({ kind: "lines", path: ".gitignore", lines: [info.envFile] })

  const warnings: string[] = []
  if (ctx.status === "to_recheck") warnings.push("Ce contexte est marqué « à revérifier » : contrôlez la source officielle avant la mise en production.")
  if (stack === "vite") warnings.push("Projet front-end détecté : les clés ne doivent pas être utilisées dans le navigateur. L'agent prévoira un backend.")

  return {
    slug: ctx.slug,
    title: ctx.title,
    service: ctx.service,
    apiVersion: ctx.apiVersion,
    verifiedAt: ctx.lastVerifiedAt,
    status: ctx.status,
    sourceUrl: ctx.sourceUrl,
    env,
    stack,
    stackLabel: info.label,
    envFile: info.envFile,
    envVars,
    files,
    suggestedRequest: `Intègre ${ctx.title} dans mon projet en suivant les règles AfriContext.`,
    warnings,
  }
}
