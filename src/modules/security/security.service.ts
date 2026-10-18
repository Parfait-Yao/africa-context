import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"
import { PUBLIC_STATUSES } from "@/modules/contexts/context.repository"
import { runContextChecks } from "@/modules/spec/context-checks"
import { redactSecrets, scanForSecrets } from "@/modules/spec/secret-scanner"
import { scanHiddenCharacters, scanUrls, type FindingSeverity } from "./content-scanner"
import type { SpecReport } from "@/modules/spec/spec.schema"

/**
 * Suivi des risques techniques. Les détections sont heuristiques (expressions régulières) :
 * faux positifs et secrets manqués sont possibles. Ce sont des alertes à examiner,
 * pas une garantie de sécurité. Aucun extrait ne contient la valeur complète d'un secret.
 */

export const ALERT_STATUSES = ["open", "acknowledged", "resolved", "false_positive"] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]
export const ALERT_KINDS = ["secret", "suspicious_url", "malformed_content"] as const
export const ALERT_SEVERITIES = ["high", "medium", "low"] as const

/** Transitions autorisées ; « open » depuis un état clos = réouverture. */
const TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  open: ["acknowledged", "resolved", "false_positive"],
  acknowledged: ["open", "resolved", "false_positive"],
  resolved: ["open"],
  false_positive: ["open"],
}

export const alertUpdateSchema = z.object({
  status: z.enum(ALERT_STATUSES),
  note: z.string().trim().max(1000).optional(),
})

export const alertFiltersSchema = z.object({
  // « active » = ouvertes et prises en charge ; « all » = tout l'historique
  status: z.enum(["active", ...ALERT_STATUSES, "all"]).default("active").catch("active"),
  kind: z.enum(ALERT_KINDS).optional().catch(undefined),
  severity: z.enum(ALERT_SEVERITIES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})
export type AlertFilters = z.infer<typeof alertFiltersSchema>

interface Detection {
  kind: (typeof ALERT_KINDS)[number]
  severity: FindingSeverity
  rule: string
  label: string
  location: string
  excerpt: string
  /** Partie stable de l'empreinte (emplacement + règle + ligne). */
  key: string
}

const MALFORMED_CHECKS = ["fields", "sections", "code", "version"] as const
const AUTO_RESOLVED_NOTE = "Plus détecté lors de la dernière analyse."
const dateLabel = (d: Date) => d.toISOString().slice(0, 10)

/** Secrets, URL suspectes et caractères invisibles d'un texte, avec un emplacement lisible. */
function detectIn(text: string, where: string, keyPrefix: string): Detection[] {
  const line = (n: number) => (text.includes("\n") ? `${where}, ligne ${n}` : where)
  return [
    ...scanForSecrets(text).map((s) => ({
      kind: "secret" as const,
      severity: (s.rule === "long-hex" ? "medium" : "high") as FindingSeverity,
      rule: s.rule,
      label: s.label,
      location: line(s.line),
      excerpt: s.excerpt,
      key: `${keyPrefix}:${s.rule}:${s.line}`,
    })),
    ...[...scanUrls(text), ...scanHiddenCharacters(text)].map((f) => ({
      kind: f.rule.startsWith("hidden-") ? ("malformed_content" as const) : ("suspicious_url" as const),
      severity: f.severity,
      rule: f.rule,
      label: f.label,
      location: line(f.line),
      excerpt: f.excerpt,
      key: `${keyPrefix}:${f.rule}:${f.line}`,
    })),
  ]
}

const fingerprint = (contextId: string, key: string) => createHash("sha256").update(`${contextId}|${key}`).digest("hex")

export const securityService = {
  /**
   * Analyse un contexte enregistré : contenu actuel, description, URL source, anciennes versions et preuves.
   * Crée les nouvelles alertes, met à jour celles déjà connues, et clôt automatiquement
   * les alertes ouvertes qui ne sont plus détectées.
   */
  async scanContext(contextId: string) {
    const ctx = await prisma.context.findUnique({
      where: { id: contextId },
      include: {
        tags: { select: { tag: { select: { name: true } } } },
        versions: { select: { id: true, contentPayload: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        proofs: { select: { id: true, prompt: true, outputWithoutContext: true, outputWithContext: true, model: true, createdAt: true } },
      },
    })
    if (!ctx) throw new HttpError(404, "Contexte introuvable.")

    const found: Detection[] = [
      ...detectIn(ctx.contentPayload, "Contenu", "content"),
      ...detectIn(ctx.description, "Description", "description"),
      ...detectIn(ctx.sourceUrl, "URL source", "source"),
    ]
    // Versions antérieures : un secret retiré du contenu reste lisible dans l'historique
    for (const v of ctx.versions) {
      if (v.contentPayload === ctx.contentPayload) continue
      found.push(...detectIn(v.contentPayload, `Version du ${dateLabel(v.createdAt)}`, `version:${v.id}`).filter((d) => d.kind === "secret"))
    }
    for (const p of ctx.proofs) {
      const text = [p.prompt, p.outputWithoutContext, p.outputWithContext].join("\n")
      found.push(...detectIn(text, `Preuve ${p.model} du ${dateLabel(p.createdAt)}`, `proof:${p.id}`).filter((d) => d.kind === "secret"))
    }
    // Contenu malformé : uniquement pour les contextes publiés (les autres sont relus en modération)
    if (PUBLIC_STATUSES.includes(ctx.status)) {
      const checks = runContextChecks({
        slug: ctx.slug,
        title: ctx.title,
        description: ctx.description,
        type: ctx.type,
        service: ctx.service,
        category: ctx.category,
        countries: ctx.countries,
        apiVersion: ctx.apiVersion,
        sourceUrl: ctx.sourceUrl,
        testedWith: ctx.testedWith,
        tags: ctx.tags.map((t) => t.tag.name),
        content: ctx.contentPayload,
      })
      for (const c of checks) {
        if (!(MALFORMED_CHECKS as readonly string[]).includes(c.key) || c.level !== "error") continue
        found.push({
          kind: "malformed_content",
          severity: c.key === "sections" || c.key === "fields" ? "medium" : "low",
          rule: `check-${c.key}`,
          label: `Contexte publié non conforme : ${c.label}`,
          location: "Fiche du contexte",
          excerpt: redactSecrets(c.details.slice(0, 2).join(" · ") || c.label).slice(0, 200),
          key: `check:${c.key}`,
        })
      }
    }

    const now = new Date()
    const seen = new Set<string>()
    let created = 0
    for (const d of found) {
      const fp = fingerprint(ctx.id, d.key)
      if (seen.has(fp)) continue
      seen.add(fp)
      const existing = await prisma.securityAlert.findUnique({ where: { fingerprint: fp }, select: { status: true, resolvedById: true } })
      if (!existing) {
        await prisma.securityAlert.create({
          data: { ...pick(d), contextId: ctx.id, contextSlug: ctx.slug, fingerprint: fp, firstSeenAt: now, lastSeenAt: now },
        })
        created++
      } else {
        // Une alerte close automatiquement puis détectée à nouveau est rouverte ; une décision humaine est conservée
        const reopen = existing.status === "resolved" && existing.resolvedById === null
        await prisma.securityAlert.update({
          where: { fingerprint: fp },
          data: {
            ...pick(d),
            contextSlug: ctx.slug,
            lastSeenAt: now,
            ...(reopen && { status: "open", resolvedAt: null, resolutionNote: null }),
          },
        })
      }
    }
    const { count: autoResolved } = await prisma.securityAlert.updateMany({
      where: { contextId: ctx.id, status: { in: ["open", "acknowledged"] }, fingerprint: { notIn: [...seen] } },
      data: { status: "resolved", resolvedAt: now, resolvedById: null, resolutionNote: AUTO_RESOLVED_NOTE },
    })
    return { slug: ctx.slug, detected: seen.size, created, autoResolved }
  },

  /** Analyse de tout le catalogue (tous statuts). */
  async scanAll() {
    const ids = await prisma.context.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } })
    const total = { contexts: 0, detected: 0, created: 0, autoResolved: 0 }
    for (const { id } of ids) {
      const r = await securityService.scanContext(id)
      total.contexts++
      total.detected += r.detected
      total.created += r.created
      total.autoResolved += r.autoResolved
    }
    return total
  },

  async list(f: AlertFilters, pageSize = 20) {
    const where: Prisma.SecurityAlertWhereInput = {
      ...(f.status === "active" ? { status: { in: ["open", "acknowledged"] } } : f.status !== "all" && { status: f.status }),
      ...(f.kind && { kind: f.kind }),
      ...(f.severity && { severity: f.severity }),
      ...(f.q && { contextSlug: { contains: f.q.toLowerCase() } }),
    }
    const [total, items] = await Promise.all([
      prisma.securityAlert.count({ where }),
      prisma.securityAlert.findMany({
        where,
        // Gravité (enum high > medium > low), puis plus récentes
        orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
        skip: (f.page - 1) * pageSize,
        take: pageSize,
        include: { context: { select: { title: true, status: true } }, resolvedBy: { select: { name: true } } },
      }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  async summary() {
    const rows = await prisma.securityAlert.groupBy({ by: ["status", "severity"], _count: { _all: true } })
    const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((n, r) => n + r._count._all, 0)
    const active = (r: (typeof rows)[number]) => r.status === "open" || r.status === "acknowledged"
    return {
      active: sum(active),
      high: sum((r) => active(r) && r.severity === "high"),
      acknowledged: sum((r) => r.status === "acknowledged"),
      resolved: sum((r) => r.status === "resolved"),
      falsePositives: sum((r) => r.status === "false_positive"),
    }
  },

  /** Décision d'un admin sur une alerte. Un faux positif doit être justifié. */
  async updateStatus(id: string, input: unknown, admin: { id: string }) {
    const { status, note } = alertUpdateSchema.parse(input)
    const alert = await prisma.securityAlert.findUnique({ where: { id }, select: { status: true, contextSlug: true, label: true } })
    if (!alert) throw new HttpError(404, "Alerte introuvable.")
    if (!TRANSITIONS[alert.status].includes(status)) throw new HttpError(409, "Cette alerte a déjà changé de statut. Rechargez la page.")
    if (status === "false_positive" && !note) throw new HttpError(400, "Expliquez pourquoi cette alerte est un faux positif.")
    const closing = status === "resolved" || status === "false_positive"
    const resolutionNote = note ? redactSecrets(note) : null
    // Condition sur l'ancien statut : deux décisions simultanées ne s'écrasent pas
    const { count } = await prisma.securityAlert.updateMany({
      where: { id, status: alert.status },
      data: {
        status,
        resolutionNote: status === "open" ? null : resolutionNote,
        resolvedAt: closing ? new Date() : null,
        resolvedById: status === "open" ? null : admin.id,
      },
    })
    if (count === 0) throw new HttpError(409, "Cette alerte a déjà changé de statut. Rechargez la page.")
    return { id, from: alert.status, to: status, contextSlug: alert.contextSlug, label: alert.label, note: resolutionNote }
  },

  // --- Échecs de validation ---

  /** Trace une soumission refusée : noms de champs et identifiants de règles uniquement, jamais le contenu. */
  async recordValidationFailure(userId: string | null, action: "submit" | "resubmit", slug: string | null, report: SpecReport) {
    try {
      await prisma.validationFailure.create({
        data: {
          userId,
          action,
          slug: slug && /^[a-z0-9-]{1,80}$/.test(slug) ? slug : null,
          fields: Object.keys(report.fieldErrors).slice(0, 20),
          missingSections: report.missingSections.length,
          secretRules: [...new Set(report.secrets.map((s) => s.rule))],
        },
      })
    } catch (e) {
      console.error("[security] échec de validation non enregistré", e instanceof Error ? e.message : e)
    }
  },

  async validationFailures(f: { blockedOnly?: boolean; page: number }, pageSize = 20) {
    const where: Prisma.ValidationFailureWhereInput = f.blockedOnly ? { secretRules: { isEmpty: false } } : {}
    const [total, items] = await Promise.all([
      prisma.validationFailure.count({ where }),
      prisma.validationFailure.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (f.page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true } } },
      }),
    ])
    return { items, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  },

  /**
   * Comportements inhabituels sur 7 jours, calculés à partir de données enregistrées.
   * Seuils indicatifs : un signal invite à regarder, il ne prouve rien.
   */
  async unusualActivity() {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const [secretBlocks, failures, reports, submissions] = await Promise.all([
      prisma.validationFailure.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, secretRules: { isEmpty: false }, userId: { not: null } }, _count: { _all: true } }),
      prisma.validationFailure.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, userId: { not: null } }, _count: { _all: true } }),
      prisma.report.groupBy({ by: ["userId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.context.groupBy({ by: ["authorId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    ])
    const signals: { userId: string; kind: string; label: string; count: number; threshold: number }[] = []
    const add = (rows: { id: string | null; n: number }[], kind: string, label: string, threshold: number) => {
      for (const r of rows) if (r.id && r.n >= threshold) signals.push({ userId: r.id, kind, label, count: r.n, threshold })
    }
    add(secretBlocks.map((r) => ({ id: r.userId, n: r._count._all })), "secret-blocks", "Soumissions bloquées pour secret", UNUSUAL_THRESHOLDS.secretBlocks)
    add(failures.map((r) => ({ id: r.userId, n: r._count._all })), "validation-failures", "Soumissions refusées", UNUSUAL_THRESHOLDS.validationFailures)
    add(reports.map((r) => ({ id: r.userId, n: r._count._all })), "reports", "Signalements envoyés", UNUSUAL_THRESHOLDS.reports)
    add(submissions.map((r) => ({ id: r.authorId, n: r._count._all })), "submissions", "Contextes soumis", UNUSUAL_THRESHOLDS.submissions)
    if (signals.length === 0) return []
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(signals.map((s) => s.userId))] } },
      select: { id: true, name: true, suspendedAt: true, role: true },
    })
    return signals
      .map((s) => ({ ...s, user: users.find((u) => u.id === s.userId) ?? null }))
      .sort((a, b) => b.count / b.threshold - a.count / a.threshold)
  },
}

/** Seuils des signaux d'activité inhabituelle (7 jours glissants). */
export const UNUSUAL_THRESHOLDS = { secretBlocks: 3, validationFailures: 15, reports: 10, submissions: 10 }

function pick(d: Detection) {
  return { kind: d.kind, severity: d.severity, rule: d.rule, label: d.label, location: d.location, excerpt: d.excerpt }
}
