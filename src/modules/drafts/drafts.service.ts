import "server-only"
import { complete } from "@/lib/ai"
import { htmlToText, safeFetchText } from "@/lib/safe-fetch"
import { parseSpecMarkdown } from "@/modules/spec/spec.parser"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { REQUIRED_SECTIONS, checkSections } from "@/modules/spec/spec.schema"
import { HttpError } from "@/lib/errors"

/** Brouillon assisté par IA (F11) : une URL de documentation devient un brouillon au format Spec, relu par un humain. */
const SYSTEM = `Tu rédiges des contextes AfriContext : des fiches techniques destinées aux assistants de code IA pour intégrer correctement une API africaine.
Règles absolues :
- N'utilise QUE les informations présentes dans la documentation fournie. N'invente aucun endpoint, champ, en-tête ou code d'erreur. Si une information manque, écris « Non documenté dans la source ».
- N'écris jamais de valeur secrète : uniquement des noms de variables d'environnement (ex. $WAVE_API_KEY).
- Réponds uniquement avec le fichier Markdown, sans texte autour.
Format exact :
---
slug: <service>-<fonction>, minuscules et tirets
title: <Service> — <fonction>
description: <une phrase de 20 à 300 caractères>
type: cursorrules
service: <Service>
category: paiement-mobile | agregateur | sms
pays: [codes ISO à 2 lettres cités par la doc]
version_api: <version>
source_url: <URL fournie>
tested_with: []
tags: [3 à 5 tags]
---
Puis exactement ces 8 sections de niveau 2 : ${REQUIRED_SECTIONS.map((s) => `## ${s.title}`).join(", ")}.
La section « Pièges courants » liste ce qu'un modèle risque d'inventer pour ce service. L'exemple est en TypeScript, minimal et typé.`

export async function draftFromUrl(url: string) {
  let page
  try {
    page = await safeFetchText(url, { maxBytes: 800_000 })
  } catch (e) {
    throw new HttpError(422, `Documentation inaccessible : ${e instanceof Error ? e.message : e}`)
  }
  const text = htmlToText(page.text).slice(0, 40_000)
  if (text.length < 200) throw new HttpError(422, "La page ne contient pas assez de texte exploitable.")

  const raw = await complete({ system: SYSTEM, prompt: `URL source : ${page.url}\n\nDocumentation :\n"""\n${text}\n"""` })
  const markdown = raw.trim().replace(/^```(?:markdown|md)?\n/, "").replace(/\n```$/, "")
  if (!markdown.startsWith("---")) throw new HttpError(502, "Le brouillon généré n'a pas le format attendu. Réessayez.")

  const fields = parseSpecMarkdown(markdown)
  return {
    markdown,
    fields: { ...fields, source_url: fields.source_url ?? url },
    missingSections: checkSections(fields.content).missing,
    secrets: scanForSecrets(markdown),
  }
}
