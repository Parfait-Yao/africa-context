#!/usr/bin/env node
/**
 * CLI AfriContext (F8)
 *   npx africontext add <slug> [--format cursorrules|claude|agents|raw] [--dry-run] [--force] [--api <url>]
 *   npx africontext search <texte>
 *
 * Règles de sécurité : n'écrit que dans le dossier courant, n'écrase jamais un fichier
 * sans confirmation, et remplace proprement un bloc déjà installé (marqueurs africontext).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve, relative } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin, stdout, exit, argv, cwd, env } from "node:process"

const VERSION = "0.1.0"
const FORMATS = ["cursorrules", "claude", "agents", "raw"] as const
type Format = (typeof FORMATS)[number]

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

function parseArgs(args: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith("--") && ["format", "api"].includes(key)) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

function usage() {
  console.log(`${c.bold("africontext")} ${VERSION}

  ${c.bold("africontext add <slug>")}       installe un contexte dans le projet
      --format <f>   cursorrules (défaut) | claude | agents | raw
      --dry-run      affiche le contenu sans rien écrire
      --force        remplace sans demander
      --api <url>    URL de la plateforme (défaut : $AFRICONTEXT_API ou https://africontext.dev)

  ${c.bold("africontext search <texte>")}   cherche dans le catalogue
  ${c.bold("africontext list")}             contextes déjà installés dans ce projet
`)
}

const apiBase = (flags: Record<string, string | boolean>) =>
  String(flags.api ?? env.AFRICONTEXT_API ?? "https://africontext.dev").replace(/\/$/, "")

async function confirm(question: string) {
  if (!stdin.isTTY) return false
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question(`${question} (o/N) `)).trim().toLowerCase()
  rl.close()
  return answer === "o" || answer === "oui" || answer === "y"
}

async function add(slug: string, flags: Record<string, string | boolean>) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Slug invalide : « ${slug} ».`)
  const format = (flags.format ?? "cursorrules") as Format
  if (!FORMATS.includes(format)) throw new Error(`Format inconnu : ${format}. Choisir parmi ${FORMATS.join(", ")}.`)

  const url = `${apiBase(flags)}/api/contexts/${slug}/raw?format=${format}`
  let res: Response
  try {
    res = await fetch(url, { headers: { "User-Agent": `africontext-cli/${VERSION}` } })
  } catch {
    throw new Error(`Impossible de joindre ${apiBase(flags)}. Vérifiez votre connexion ou l'option --api.`)
  }
  if (res.status === 429) throw new Error("Trop de requêtes : réessayez dans une minute.")
  if (res.status === 404) throw new Error(`Aucun contexte publié pour « ${slug} ». Cherchez-le avec : africontext search ${slug.split("-")[0]}`)
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)

  const body = await res.text()
  const target = res.headers.get("x-africontext-target") ?? `${slug}.md`
  const verifiedAt = res.headers.get("x-africontext-verified-at")?.slice(0, 10)
  const status = res.headers.get("x-africontext-status")

  // Protection contre l'écriture hors du projet (ex. "../../.bashrc")
  const root = cwd()
  const dest = resolve(root, target)
  if (relative(root, dest).startsWith("..")) throw new Error(`Chemin cible refusé : ${target}`)

  console.log(c.green("✔"), `Contexte ${c.bold(slug)}${verifiedAt ? c.dim(` — vérifié le ${verifiedAt}`) : ""}`)
  if (status === "to_recheck") console.log(c.yellow("!"), "Ce contexte est marqué « à revérifier » : contrôlez la source officielle.")

  if (flags["dry-run"]) {
    console.log(c.dim(`--- ${target} (aperçu, rien n'est écrit) ---`))
    console.log(body)
    return
  }

  const startMarker = `<!-- africontext:${slug}:start -->`
  const endMarker = `<!-- africontext:${slug}:end -->`
  const isBlock = format === "claude" || format === "agents"

  if (existsSync(dest)) {
    const current = readFileSync(dest, "utf8")
    if (isBlock) {
      const start = current.indexOf(startMarker)
      const end = current.indexOf(endMarker)
      const next =
        start !== -1 && end !== -1
          ? current.slice(0, start) + body.trimEnd() + current.slice(end + endMarker.length)
          : `${current.trimEnd()}\n\n${body}`
      writeFileSync(dest, next.endsWith("\n") ? next : `${next}\n`)
      console.log(c.green("✔"), start !== -1 ? `Bloc mis à jour dans ${target}` : `Bloc ajouté à ${target}`)
      return
    }
    if (!flags.force && !(await confirm(`${target} existe déjà. Le remplacer ?`))) {
      console.log(c.yellow("•"), `${target} conservé. Relancez avec --force pour le remplacer.`)
      return
    }
  }

  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, body)
  console.log(c.green("✔"), `Écrit dans ${target}`)
}

async function search(query: string, flags: Record<string, string | boolean>) {
  const res = await fetch(`${apiBase(flags)}/api/contexts?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)
  const { data } = (await res.json()) as { data: { total: number; items: { slug: string; title: string; status: string }[] } }
  if (data.total === 0) return console.log("Aucun contexte trouvé.")
  for (const item of data.items) console.log(`${c.bold(item.slug.padEnd(34))} ${item.title}${item.status === "to_recheck" ? c.yellow(" (à revérifier)") : ""}`)
  console.log(c.dim(`\nInstaller : npx africontext add <slug>`))
}

/** Liste les contextes installés : règles Cursor + blocs délimités dans CLAUDE.md / AGENTS.md. */
function list() {
  const root = cwd()
  const found: { slug: string; file: string }[] = []
  const rulesDir = resolve(root, ".cursor/rules")
  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir)) {
      if (f.endsWith(".mdc") && readFileSync(resolve(rulesDir, f), "utf8").includes("Contexte AfriContext")) found.push({ slug: f.replace(/\.mdc$/, ""), file: `.cursor/rules/${f}` })
    }
  }
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
