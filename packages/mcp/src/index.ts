#!/usr/bin/env node
/**
 * Serveur MCP AfriContext (F14) — transport stdio.
 * Outils : search_context(query, country?) et get_context(slug, format?).
 * Ne renvoie que des contextes publiés (l'API publique filtre les statuts).
 *
 * Cursor (.cursor/mcp.json) / Claude Code (claude mcp add) :
 *   { "mcpServers": { "africontext": { "command": "npx", "args": ["-y", "africontext-mcp"], "env": { "AFRICONTEXT_API": "https://africontext.dev" } } } }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const API = (process.env.AFRICONTEXT_API ?? "https://africontext.dev").replace(/\/$/, "")
const UA = { "User-Agent": "africontext-mcp/0.1.0" }

const server = new McpServer({ name: "africontext", version: "0.1.0" })

server.registerTool(
  "search_context",
  {
    title: "Chercher un contexte AfriContext",
    description:
      "Cherche des contextes techniques vérifiés pour intégrer un service africain (Wave, Orange Money, FedaPay, MTN MoMo, API SMS…). À appeler AVANT d'écrire du code pour ces services, pour éviter d'inventer des endpoints.",
    inputSchema: {
      query: z.string().min(2).describe("Service ou besoin, ex. « wave checkout », « sms sénégal »"),
      country: z.string().length(2).optional().describe("Code pays ISO, ex. CI, SN, BJ"),
    },
  },
  async ({ query, country }) => {
    const url = new URL(`${API}/api/contexts`)
    url.searchParams.set("q", query)
    if (country) url.searchParams.set("country", country.toUpperCase())
    const res = await fetch(url, { headers: UA })
    if (!res.ok) return { isError: true, content: [{ type: "text", text: `AfriContext a répondu ${res.status}.` }] }
    const { data } = (await res.json()) as {
      data: { total: number; items: { slug: string; title: string; service: string; status: string; lastVerifiedAt: string; countries: string[]; apiVersion: string }[] }
    }
    if (data.total === 0) return { content: [{ type: "text", text: `Aucun contexte pour « ${query} ». Ne devine pas l'API : demande la documentation officielle.` }] }
    const lines = data.items.map(
      (c) => `- ${c.slug} — ${c.title} (API ${c.apiVersion}, ${c.countries.join("/")}, vérifié le ${c.lastVerifiedAt.slice(0, 10)}${c.status === "to_recheck" ? ", À REVÉRIFIER" : ""})`
    )
    return { content: [{ type: "text", text: `${data.total} contexte(s) :\n${lines.join("\n")}\n\nRécupère-en un avec get_context(slug).` }] }
  }
)

server.registerTool(
  "get_context",
  {
    title: "Récupérer un contexte AfriContext",
    description: "Renvoie le contenu complet d'un contexte vérifié : authentification, endpoints, erreurs, webhooks, pièges courants, exemple et variables d'environnement.",
    inputSchema: {
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).describe("Slug renvoyé par search_context"),
      format: z.enum(["raw", "agents", "claude", "cursorrules"]).optional(),
    },
  },
  async ({ slug, format }) => {
    const res = await fetch(`${API}/api/contexts/${slug}/raw?format=${format ?? "raw"}`, { headers: UA })
    if (res.status === 404) return { isError: true, content: [{ type: "text", text: `Contexte « ${slug} » introuvable ou non publié.` }] }
    if (!res.ok) return { isError: true, content: [{ type: "text", text: `AfriContext a répondu ${res.status}.` }] }
    return { content: [{ type: "text", text: await res.text() }] }
  }
)

await server.connect(new StdioServerTransport())
