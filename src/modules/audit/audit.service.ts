import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"
import { redactSecrets } from "@/modules/spec/secret-scanner"

/**
 * Journal d'audit des opérations sensibles (table AuditLog, en ajout seul : un trigger PostgreSQL
 * refuse UPDATE et DELETE). Ce module n'expose ni modification ni suppression.
 * Aucun mot de passe, jeton ou secret n'y est écrit : les clés sensibles sont retirées
 * et les textes libres passent par `redactSecrets`.
 */

export const AUDIT_ACTIONS = {
  "context.moderate": "Changement de statut d'un contexte",
  "context.delete": "Suppression d'un contexte",
  "context.proof.add": "Ajout d'une preuve",
  "report.decide": "Traitement d'un signalement",
  "user.role": "Changement de rôle",
  "user.suspension": "Suspension ou réactivation d'un compte",
  "user.delete": "Retrait d'un compte",
  "tag.create": "Création d'un tag",
  "tag.rename": "Renommage d'un tag",
  "tag.delete": "Suppression d'un tag",
  "service.rename": "Renommage d'un service",
  "settings.update": "Modification d'un paramètre",
  "security.scan": "Analyse de sécurité",
  "security.alert": "Traitement d'une alerte de sécurité",
  "source.check": "Vérification d'une source documentaire",
} as const
export type AuditAction = keyof typeof AUDIT_ACTIONS

export const AUDIT_CATEGORIES = {
  context: "Contextes",
  report: "Signalements",
  user: "Comptes",
  catalog: "Catalogue",
  settings: "Paramètres",
  security: "Sécurité",
  source: "Documentation",
} as const
type AuditCategory = keyof typeof AUDIT_CATEGORIES

const CATEGORY_PREFIXES: Record<AuditCategory, string[]> = {
  context: ["context."],
  report: ["report."],
  user: ["user."],
  catalog: ["tag.", "service."],
  settings: ["settings."],
  security: ["security."],
  source: ["source."],
}

export interface AuditActor {
  id: string | null
  name: string
}

export interface AuditTarget {
  type: string
  id?: string | null
  label?: string | null
}

const SENSITIVE_KEY = /pass(word)?|hash|token|secret|api_?key|authorization|cookie/i

/** Copie sûre des détails : clés sensibles retirées, textes expurgés et tronqués, profondeur limitée. */
export function sanitizeDetails(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return redactSecrets(value).slice(0, 1000)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (value instanceof Date) return value.toISOString()
  if (depth >= 3) return null
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeDetails(v, depth + 1)) as Prisma.InputJsonValue
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k) || v === undefined) continue
      out[k] = sanitizeDetails(v, depth + 1)
    }
    return out as Prisma.InputJsonValue
  }
  return null
}

export const auditService = {
  async record(entry: {
    actor: AuditActor
    action: AuditAction
    target: AuditTarget
    outcome?: "success" | "refused" | "error"
    details?: Record<string, unknown>
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: entry.actor.id,
        actorName: entry.actor.name || "Inconnu",
        action: entry.action,
        targetType: entry.target.type,
        targetId: entry.target.id ?? null,
        targetLabel: entry.target.label ? redactSecrets(entry.target.label).slice(0, 200) : null,
        outcome: entry.outcome ?? "success",
        details: entry.details ? (sanitizeDetails(entry.details) as Prisma.InputJsonValue) : undefined,
      },
    })
  },

  /**
   * Exécute une opération sensible et la journalise avec son résultat :
   * succès, refus métier (HttpError 4xx : règle violée, conflit…) ou erreur interne.
   * L'erreur d'origine est toujours relancée. Si l'écriture du journal échoue, l'opération
   * déjà effectuée n'est pas annulée : l'échec est signalé dans les logs serveur.
   */
  async track<T>(
    actor: AuditActor,
    action: AuditAction,
    target: AuditTarget,
    run: () => Promise<T>,
    details?: (result: T) => Record<string, unknown>,
    input?: Record<string, unknown>
  ): Promise<T> {
    const write = async (outcome: "success" | "refused" | "error", extra: Record<string, unknown>) => {
      try {
        await auditService.record({ actor, action, target, outcome, details: { ...input, ...extra } })
      } catch (e) {
        console.error("[audit] écriture impossible", action, e instanceof Error ? e.message : e)
      }
    }
    try {
      const result = await run()
      await write("success", details ? details(result) : {})
      return result
    } catch (err) {
      if (err instanceof HttpError && err.status < 500) await write("refused", { error: err.message, status: err.status })
      else if (err instanceof z.ZodError) await write("refused", { error: "Données invalides." })
      else await write("error", { error: "Erreur interne." })
      throw err
    }
  },

  async list(f: AuditFilters, pageSize = 30) {
    const where: Prisma.AuditLogWhereInput = {
      ...(f.category && { OR: CATEGORY_PREFIXES[f.category].map((p) => ({ action: { startsWith: p } })) }),
      ...(f.outcome && { outcome: f.outcome }),
      ...(f.actor && { actorName: { contains: f.actor, mode: "insensitive" } }),
      ...(f.target && {
        OR: [{ targetId: f.target }, { targetLabel: { contains: f.target, mode: "insensitive" } }],
      }),
      ...((f.from || f.to) && {
        createdAt: {
          ...(f.from && { gte: new Date(`${f.from}T00:00:00.000Z`) }),
          ...(f.to && { lte: new Date(`${f.to}T23:59:59.999Z`) }),
        },
      }),
    }
    // Catégorie et cible utilisent toutes deux OR : on les combine par AND
    if (f.category && f.target) {
      delete where.OR
      where.AND = [
        { OR: CATEGORY_PREFIXES[f.category].map((p) => ({ action: { startsWith: p } })) },
        { OR: [{ targetId: f.target }, { targetLabel: { contains: f.target, mode: "insensitive" } }] },
      ]
    }
    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * pageSize, take: pageSize }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  /** Historique d'une cible (alerte, contexte…), du plus récent au plus ancien. */
  forTarget: (type: string, id: string, take = 20) =>
    prisma.auditLog.findMany({ where: { targetType: type, targetId: id }, orderBy: { createdAt: "desc" }, take }),
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined)

export const auditFiltersSchema = z.object({
  category: z.enum(Object.keys(AUDIT_CATEGORIES) as [AuditCategory, ...AuditCategory[]]).optional().catch(undefined),
  outcome: z.enum(["success", "refused", "error"]).optional().catch(undefined),
  actor: z.string().trim().max(100).optional().catch(undefined),
  target: z.string().trim().max(200).optional().catch(undefined),
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})
export type AuditFilters = z.infer<typeof auditFiltersSchema>

/** Acteur d'audit à partir de la session admin. */
export const actorOf = (user: { id: string; name: string; email?: string }): AuditActor => ({ id: user.id, name: user.name || user.email || "Administrateur" })
