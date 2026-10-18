#!/usr/bin/env node
/**
 * CLI AfriContext (F8)
 *   npx africontext add <slug> [--env cursor|claude|windsurf|copilot|agents] [--dry-run] [--force] [--api <url>]
 *   npx africontext search <texte>
 *   npx africontext list
 *
 * `add` installe tout ce dont l'agent IA a besoin, en une commande : règles adaptées au projet
 * (framework détecté), variables d'environnement à remplir (.env.example + fichier .env local),
 * et .env protégé dans .gitignore. Le plan vient du serveur ; la CLI l'applique avec ces règles de sécurité :
 * écriture uniquement dans le dossier courant, jamais de valeur secrète écrite, jamais d'écrasement
 * d'un fichier qui n'appartient pas à AfriContext sans confirmation, blocs délimités remplacés proprement.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve, relative, isAbsolute } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin, stdout, exit, argv, cwd, env as processEnv } from "node:process"

const VERSION = "0.2.0"
const ENVS = ["cursor", "claude", "windsurf", "copilot", "agents"] as const
type Env = (typeof ENVS)[number]
const ENV_LABELS: Record<Env, string> = { cursor: "Cursor", claude: "Claude Code", windsurf: "Windsurf", copilot: "GitHub Copilot", agents: "Autre agent (AGENTS.md)" }
/** Ancienne option --format, toujours acceptée. */
const LEGACY_FORMATS: Record<string, Env> = { cursorrules: "cursor", claude: "claude", agents: "agents" }

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

interface EnvVar {
  name: string
  description?: string
}
type PlanFile =
  | { kind: "file"; path: string; content: string }
  | { kind: "block"; path: string; content: string; start: string; end: string }
  | { kind: "env"; path: string; header: string; vars: EnvVar[] }
  | { kind: "lines"; path: string; lines: string[] }
interface InstallPlan {
  slug: string
  title: string
  verifiedAt: string
  status: string
  sourceUrl: string
  env: Env
  stackLabel: string
  envFile: string
  envVars: EnvVar[]
  files: PlanFile[]
  suggestedRequest: string
  warnings: string[]
}

function parseArgs(args: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith("--") && ["env", "format", "api"].includes(key)) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

function usage() {
  console.log(`${c.bold("africontext")} ${VERSION}

  ${c.bold("africontext add <slug> --env <outil>")}   installe tout ce dont votre agent IA a besoin
      --env <outil>  ${ENVS.join(" | ")} (détecté automatiquement si absent)
      --dry-run      affiche ce qui serait fait, sans rien écrire
      --force        remplace un fichier existant sans demander
      --api <url>    URL de la plateforme (défaut : $AFRICONTEXT_API ou https://africontext.dev)

  ${c.bold("africontext search <texte>")}   cherche dans le catalogue
  ${c.bold("africontext list")}             contextes déjà installés dans ce projet
`)
}

const apiBase = (flags: Record<string, string | boolean>) =>
  String(flags.api ?? processEnv.AFRICONTEXT_API ?? "https://africontext.dev").replace(/\/$/, "")

async function ask(question: string) {
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question(question)).trim()
  rl.close()
  return answer
}

async function confirm(question: string) {
  if (!stdin.isTTY) return false
  const answer = (await ask(`${question} (o/N) `)).toLowerCase()
  return answer === "o" || answer === "oui" || answer === "y"
}

/** Framework du projet, pour adapter les consignes de l'agent et le nom du fichier .env. */
function detectStack(root: string) {
  const pkgPath = resolve(root, "package.json")
  if (existsSync(pkgPath)) {
    let deps: Record<string, string> = {}
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      deps = { ...pkg.dependencies, ...pkg.devDependencies }
    } catch {}
    const has = (name: string) => name in deps
    if (has("next")) return "next"
    if (has("nuxt")) return "nuxt"
    if (has("@sveltejs/kit")) return "sveltekit"
    if (has("@remix-run/node") || has("@react-router/node")) return "remix"
    if (has("@nestjs/core")) return "nest"
    if (has("express")) return "express"
    if (has("fastify")) return "fastify"
    if (has("vite")) return "vite"
    return "node"
  }
  if (["requirements.txt", "pyproject.toml", "Pipfile"].some((f) => existsSync(resolve(root, f)))) return "python"
  return "unknown"
}

/** Outils IA déjà présents dans le projet. */
function detectEnvs(root: string): Env[] {
  const found: Env[] = []
  const at = (p: string) => existsSync(resolve(root, p))
  if (at(".cursor") || at(".cursorrules")) found.push("cursor")
  if (at("CLAUDE.md") || at(".claude")) found.push("claude")
  if (at(".windsurf") || at(".windsurfrules")) found.push("windsurf")
  if (at(".github/copilot-instructions.md") || at(".github/instructions")) found.push("copilot")
  if (at("AGENTS.md")) found.push("agents")
  return found
}

async function chooseEnv(flags: Record<string, string | boolean>, root: string): Promise<Env> {
  if (typeof flags.env === "string") {
    if (!ENVS.includes(flags.env as Env)) throw new Error(`Environnement inconnu : ${flags.env}. Choisir parmi ${ENVS.join(", ")}.`)
    return flags.env as Env
  }
  if (typeof flags.format === "string") {
    const legacy = LEGACY_FORMATS[flags.format]
    if (!legacy) throw new Error(`Format inconnu : ${flags.format}. Utilisez --env ${ENVS.join("|")}.`)
    return legacy
  }
  const detected = detectEnvs(root)
  if (detected.length === 1) {
    console.log(c.dim(`Environnement détecté : ${ENV_LABELS[detected[0]]} (changer avec --env)`))
    return detected[0]
  }
  if (!stdin.isTTY) {
    if (detected.length === 0) return "agents"
    throw new Error(`Plusieurs outils IA détectés (${detected.join(", ")}) : précisez --env.`)
  }
  const options = detected.length ? detected : [...ENVS]
  console.log("Quel outil IA utilisez-vous dans ce projet ?")
  options.forEach((e, i) => console.log(`  ${c.bold(String(i + 1))}. ${ENV_LABELS[e]}`))
  const n = Number(await ask(`Votre choix (1-${options.length}) : `))
  if (!Number.isInteger(n) || n < 1 || n > options.length) throw new Error("Choix invalide.")
  return options[n - 1]
}

/** Chemin relatif au projet uniquement (refuse absolu, « .. », lecteurs Windows). */
function safePath(root: string, p: string) {
  if (typeof p !== "string" || !p || isAbsolute(p) || /^[a-zA-Z]:/.test(p) || p.includes("\0")) throw new Error(`Chemin refusé : ${p}`)
  const dest = resolve(root, p)
  const rel = relative(root, dest)
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Chemin refusé : ${p}`)
  return dest
}

const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/

/** Une ligne de .gitignore couvre-t-elle ce fichier ? (motifs simples : exact, `*`, `/` initial). */
function ignored(gitignore: string, file: string) {
  return gitignore.split(/\r?\n/).some((raw) => {
    const line = raw.trim().replace(/^\//, "")
    if (!line || line.startsWith("#") || line.startsWith("!")) return false
    const re = new RegExp(`^${line.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`)
    return re.test(file)
  })
}

type Outcome = { path: string; action: string } | null

async function applyFile(root: string, f: PlanFile, flags: Record<string, string | boolean>): Promise<Outcome> {
  const dest = safePath(root, f.path)
  const exists = existsSync(dest)
  const current = exists ? readFileSync(dest, "utf8") : ""
  const write = (content: string) => {
    if (flags["dry-run"]) return
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, content.endsWith("\n") ? content : `${content}\n`)
  }

  switch (f.kind) {
    case "file": {
      if (exists && current === f.content) return { path: f.path, action: "déjà à jour" }
      // Un fichier qui ne vient pas d'AfriContext n'est remplacé qu'avec accord
      if (exists && !/africontext/i.test(current) && !flags.force && !(await confirm(`${f.path} existe déjà. Le remplacer ?`))) {
        return { path: f.path, action: "conservé (relancez avec --force pour le remplacer)" }
      }
      write(f.content)
      return { path: f.path, action: exists ? "mis à jour" : "créé" }
    }
    case "block": {
      const s = current.indexOf(f.start)
      const e = current.indexOf(f.end)
      const next =
        s !== -1 && e > s ? current.slice(0, s) + f.content.trimEnd() + current.slice(e + f.end.length) : exists ? `${current.trimEnd()}\n\n${f.content}` : f.content
      if (next === current) return { path: f.path, action: "déjà à jour" }
      write(next)
      return { path: f.path, action: s !== -1 ? "bloc mis à jour" : exists ? "bloc ajouté" : "créé" }
    }
    case "env": {
      const missing = f.vars.filter((v) => ENV_NAME.test(v.name) && !new RegExp(`^\\s*(export\\s+)?${v.name}\\s*=`, "m").test(current))
      if (missing.length === 0) return { path: f.path, action: "variables déjà présentes" }
      const lines = [`# ${f.header}`, ...missing.flatMap((v) => [...(v.description ? [`# ${v.description}`] : []), `${v.name}=`])]
      write(`${current.trimEnd()}${current.trim() ? "\n\n" : ""}${lines.join("\n")}`)
      return { path: f.path, action: `${missing.length} variable(s) ajoutée(s)` }
    }
    case "lines": {
      const missing = f.lines.filter((l) => !ignored(current, l))
      if (missing.length === 0) return null
      write(`${current.trimEnd()}${current.trim() ? "\n" : ""}${missing.join("\n")}`)
      return { path: f.path, action: `${missing.join(", ")} ignoré par git` }
    }
    default:
      return null
  }
}

async function add(slug: string, flags: Record<string, string | boolean>) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Slug invalide : « ${slug} ».`)
  const root = cwd()
  const env = await chooseEnv(flags, root)
  const stack = detectStack(root)

  const url = `${apiBase(flags)}/api/contexts/${slug}/install?env=${env}&stack=${stack}`
  let res: Response
  try {
    res = await fetch(url, { headers: { "User-Agent": `africontext-cli/${VERSION}`, Accept: "application/json" } })
  } catch {
    throw new Error(`Impossible de joindre ${apiBase(flags)}. Vérifiez votre connexion ou l'option --api.`)
  }
  if (res.status === 429) throw new Error("Trop de requêtes : réessayez dans une minute.")
  if (res.status === 404) throw new Error(`Aucun contexte publié pour « ${slug} ». Cherchez-le avec : npx africontext search ${slug.split("-")[0]}`)
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)
  const { data: plan } = (await res.json()) as { data: InstallPlan }
  if (!plan || !Array.isArray(plan.files)) throw new Error("Réponse du serveur inattendue.")

  console.log(c.green("✔"), `${c.bold(plan.title)} ${c.dim(`— vérifié le ${plan.verifiedAt.slice(0, 10)}`)}`)
  console.log(c.dim(`  ${ENV_LABELS[env]} · ${plan.stackLabel}${flags["dry-run"] ? " · aperçu, rien n'est écrit" : ""}`))
  for (const w of plan.warnings) console.log(c.yellow("!"), w)
  console.log()

  for (const f of plan.files) {
    const r = await applyFile(root, f, flags)
    if (r) console.log(`  ${r.action.startsWith("conservé") ? c.yellow("•") : c.green("✔")} ${r.path.padEnd(48)} ${c.dim(r.action)}`)
  }

  if (flags["dry-run"]) {
    const rules = plan.files.find((f) => f.kind === "file" || f.kind === "block") as { content: string } | undefined
    if (rules) console.log(`\n${c.dim("--- Règles de l'agent (aperçu) ---")}\n${rules.content}`)
    return
  }

  console.log()
  if (plan.envVars.length) {
    console.log(c.bold("1. Renseignez vos clés"), c.dim(`dans ${plan.envFile} :`), plan.envVars.map((v) => c.cyan(v.name)).join(", "))
    console.log(c.bold("2. Demandez à votre agent :"), `« ${plan.suggestedRequest} »`)
  } else {
    console.log(c.bold("Demandez à votre agent :"), `« ${plan.suggestedRequest} »`)
  }
  console.log(c.dim(`   Documentation officielle : ${plan.sourceUrl}`))
}

async function search(query: string, flags: Record<string, string | boolean>) {
  const res = await fetch(`${apiBase(flags)}/api/contexts?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)
  const { data } = (await res.json()) as { data: { total: number; items: { slug: string; title: string; status: string }[] } }
  if (data.total === 0) return console.log("Aucun contexte trouvé.")
  for (const item of data.items) console.log(`${c.bold(item.slug.padEnd(34))} ${item.title}${item.status === "to_recheck" ? c.yellow(" (à revérifier)") : ""}`)
  console.log(c.dim(`\nInstaller : npx africontext add <slug>`))
}

/** Liste les contextes installés, tous outils confondus. */
function list() {
  const root = cwd()
  const found: { slug: string; file: string }[] = []
  const scanDir = (dir: string, ext: RegExp) => {
    const p = resolve(root, dir)
    if (!existsSync(p)) return
    for (const f of readdirSync(p)) {
      if (ext.test(f) && /Contexte AfriContext|AfriContext\)/.test(readFileSync(resolve(p, f), "utf8"))) found.push({ slug: f.replace(ext, ""), file: `${dir}/${f}` })
    }
  }
  scanDir(".cursor/rules", /\.mdc$/)
  scanDir(".windsurf/rules", /\.md$/)
  scanDir(".github/instructions", /\.instructions\.md$/)
  for (const file of ["CLAUDE.md", "AGENTS.md"]) {
    const p = resolve(root, file)
    if (!existsSync(p)) continue
    for (const m of readFileSync(p, "utf8").matchAll(/<!-- africontext:([a-z0-9-]+):start -->/g)) found.push({ slug: m[1], file })
  }
  if (found.length === 0) return console.log("Aucun contexte AfriContext installé dans ce dossier.")
  for (const f of found) console.log(`${c.bold(f.slug.padEnd(34))} ${c.dim(f.file)}`)
}

async function main() {
  const { positional, flags } = parseArgs(argv.slice(2))
  const [command, arg] = positional
  if (flags.version) return console.log(VERSION)
  if (!command || flags.help) return usage()
  if (command === "add" && arg) return add(arg, flags)
  if (command === "search" && arg) return search(positional.slice(1).join(" "), flags)
  if (command === "list") return list()
  usage()
  exit(1)
}

main().catch((err: Error) => {
  console.error(c.red("✖"), err.message)
  exit(1)
})
