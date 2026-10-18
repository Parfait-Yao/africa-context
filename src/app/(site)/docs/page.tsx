import type { Metadata } from "next"
import { InstallCommand } from "@/components/contexts/install-command"
import { FORMAT_META } from "@/modules/contexts/context.formats"
import { EXPORT_FORMATS } from "@/modules/contexts/context.types"
import { REQUIRED_SECTIONS } from "@/modules/spec/spec.schema"

export const metadata: Metadata = {
  title: "CLI & formats",
  description: "Installer un contexte AfriContext avec la CLI, l'endpoint brut ou un export par outil.",
}

const frontmatter = `slug: wave-checkout-api
title: Wave - API Checkout
type: cursorrules          # cursorrules | claude_prompt | mcp_server
service: Wave
pays: [SN, CI]
version_api: v1
source_url: https://docs.wave.com/checkout
tested_with: [cursor, claude-code]
last_verified_at: 2026-10-20
tags: [fintech, paiement-mobile]`

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-code-bg p-4 font-mono text-[0.82rem] leading-6 text-code-fg">{children}</pre>
}

export default function DocsPage() {
  return (
    <div className="container-page grid grid-cols-1 gap-12 py-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:py-14">
      <nav aria-label="Sommaire" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <ul className="space-y-2 text-sm">
          {[["cli", "La CLI"], ["raw", "Endpoint brut"], ["formats", "Formats"], ["mcp", "Serveur MCP"], ["sandbox", "Sandbox"], ["spec", "AfriContext Spec"]].map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="text-muted-foreground hover:text-foreground">{label}</a></li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 max-w-3xl space-y-14">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">CLI & formats</h1>
          <p className="mt-3 text-muted-foreground">Trois façons de donner un contexte à votre assistant, de la plus rapide à la plus manuelle.</p>
        </header>

        <section id="cli" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">La CLI</h2>
          <p className="text-muted-foreground">
            Une seule commande, à la racine du projet, installe tout ce dont votre agent a besoin : ses règles (endpoints, authentification,
            webhooks, pièges, exemple) complétées par les consignes propres à votre framework, les variables d'environnement à remplir
            et la protection de votre <code className="font-mono">.env</code>. Pas de prompt à copier, pas de fichier à exporter.
          </p>
          <InstallCommand slug="wave-checkout-api" showFormats envVars={["WAVE_API_KEY", "WAVE_WEBHOOK_SECRET", "APP_URL"]} />
          <Code>{`npx africontext add orange-money-webpay --env claude    # Claude Code
npx africontext add orange-money-webpay                 # outil détecté (ou proposé) automatiquement
npx africontext add orange-money-webpay --dry-run       # affiche ce qui serait fait, sans écrire
npx africontext search "orange money"                   # cherche dans le catalogue
npx africontext list                                    # contextes installés dans le projet`}</Code>
          <p className="text-sm text-muted-foreground">
            Environnements : <code className="font-mono">cursor</code>, <code className="font-mono">claude</code>, <code className="font-mono">windsurf</code>,{" "}
            <code className="font-mono">copilot</code>, <code className="font-mono">agents</code> (AGENTS.md : Codex, Gemini CLI…). Frameworks reconnus : Next.js,
            Nuxt, SvelteKit, Remix, NestJS, Express, Fastify, Vite, Node.js, Python. Les variables sont ajoutées vides : aucune clé n'est jamais écrite.
            Relancer la commande met les règles à jour ; un fichier qui n'a pas été créé par AfriContext n'est jamais remplacé sans votre accord.
          </p>
        </section>

        <section id="raw" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Endpoint brut</h2>
          <p className="text-muted-foreground">Chaque contexte publié est servi en Markdown, pour vos scripts ou un autre outil.</p>
          <Code>{`curl https://africontext.dev/api/contexts/wave-checkout-api/raw
curl "https://africontext.dev/api/contexts/wave-checkout-api/raw?format=claude"`}</Code>
        </section>

        <section id="formats" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Formats d'export</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60">
                <tr><th className="px-4 py-2.5 font-semibold">Format</th><th className="px-4 py-2.5 font-semibold">Fichier écrit</th><th className="px-4 py-2.5 font-semibold">Usage</th></tr>
              </thead>
              <tbody>
                {EXPORT_FORMATS.map((f) => (
                  <tr key={f} className="border-t">
                    <td className="px-4 py-3 font-mono">{f}</td>
                    <td className="px-4 py-3 font-mono text-xs">{FORMAT_META[f].fileName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{FORMAT_META[f].description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="mcp" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Serveur MCP</h2>
          <p className="text-muted-foreground">Votre assistant cherche lui-même le bon contexte avant d'écrire le code : outils <code className="font-mono">search_context</code> et <code className="font-mono">get_context</code>.</p>
          <Code>{`// .cursor/mcp.json
{ "mcpServers": { "africontext": { "command": "npx", "args": ["-y", "africontext-mcp"],
  "env": { "AFRICONTEXT_API": "https://africontext.dev" } } } }

# Claude Code
claude mcp add africontext -e AFRICONTEXT_API=https://africontext.dev -- npx -y africontext-mcp`}</Code>
        </section>

        <section id="sandbox" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Sandbox</h2>
          <p className="text-muted-foreground">
            Faux serveurs Wave, Orange Money et FedaPay qui valident les requêtes comme les vraies API et envoient des webhooks signés.
            Le code généré s'exécute dans un processus isolé, sans accès réseau hors sandbox.
          </p>
          <Code>{`npm run sandbox                                   # http://localhost:4010
npm run sandbox:test -- mon-code.ts --scenario wave    # wave | orange | fedapay

  ✔ Appelle l'endpoint réel POST /v1/checkout/sessions
  ✔ La requête est acceptée par Wave (2xx)
  ✔ Renvoie l'URL de paiement wave_launch_url
  ✔ Vérifie la signature du webhook
  TEST RÉUSSI`}</Code>
        </section>

        <section id="spec" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">AfriContext Spec</h2>
          <p className="text-muted-foreground">Chaque contexte commence par cet en-tête. Le formulaire refuse une soumission qui ne le respecte pas et indique ce qui manque.</p>
          <Code>{frontmatter}</Code>
          <h3 className="pt-2 text-lg font-semibold">Sections obligatoires du corps</h3>
          <ol className="list-decimal space-y-1.5 pl-6">
            {REQUIRED_SECTIONS.map((s) => <li key={s.key}>{s.title}</li>)}
          </ol>
          <p className="text-sm text-muted-foreground">
            Règles de validation : <code className="font-mono">source_url</code> obligatoire en HTTPS, <code className="font-mono">type</code> parmi les
            trois valeurs, toutes les sections présentes, aucun secret détecté.
          </p>
        </section>
      </article>
    </div>
  )
}
