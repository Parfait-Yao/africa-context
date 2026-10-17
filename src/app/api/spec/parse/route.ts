import { parseSpecMarkdown } from "@/modules/spec/spec.parser"
import { ok, fail } from "@/lib/api"

/** POST /api/spec/parse { markdown } — lit l'en-tête d'un fichier .md pour pré-remplir le formulaire. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { markdown?: string }
  if (typeof body.markdown !== "string" || body.markdown.length > 200_000) return fail(400, "Markdown attendu (200 Ko maximum).")
  try {
    return ok(parseSpecMarkdown(body.markdown))
  } catch {
    return fail(422, "En-tête YAML illisible.")
  }
}
