import "server-only"

/**
 * Client IA minimal, sans SDK.
 * AI_PROVIDER=anthropic (défaut) → API Messages de Claude.
 * AI_PROVIDER=openai → n'importe quelle API compatible OpenAI (Gemini, Groq, Ollama…) via AI_BASE_URL.
 * AI_API_KEY absente → fonctions IA désactivées proprement.
 * AI_BASE_URL permet aussi de pointer vers un faux modèle en test.
 */
export const aiEnabled = () => Boolean(process.env.AI_API_KEY)

export async function complete({ system, prompt, maxTokens = 4000 }: { system: string; prompt: string; maxTokens?: number }) {
  const key = process.env.AI_API_KEY
  if (!key) throw new Error("AI_API_KEY non configurée.")

  if (process.env.AI_PROVIDER === "openai") {
    if (!process.env.AI_BASE_URL) throw new Error("AI_BASE_URL requise avec AI_PROVIDER=openai.")
    const res = await fetch(`${process.env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    })
    if (!res.ok) throw new Error(`API IA : HTTP ${res.status}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
    return json.choices?.[0]?.message?.content ?? ""
  }

  const res = await fetch(`${process.env.AI_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`API IA : HTTP ${res.status}`)
  const json = (await res.json()) as { content?: { type: string; text?: string }[] }
  return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("")
}
