import "server-only"

/**
 * Limiteur de débit simple (fenêtre fixe, en mémoire).
 * Suffisant pour une instance unique ; passer sur Redis/PostgreSQL si plusieurs instances.
 */
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }
  entry.count += 1
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) }
}

export function clientKey(req: Request, scope: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  return `${scope}:${ip}`
}
