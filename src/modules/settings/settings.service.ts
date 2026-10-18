import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"
import type { Prisma } from "@/generated/prisma/client"

/**
 * Paramètres de la plateforme modifiables depuis l'administration.
 * Seules les valeurs réellement lues par le code figurent ici ; chacune a un schéma de validation
 * et une valeur par défaut (utilisée tant qu'aucune valeur n'est enregistrée, ou si la valeur stockée est invalide).
 * Tout ce qui relève du déploiement (secrets, URL, fournisseurs OAuth) reste dans l'environnement serveur.
 */
export const SETTINGS = {
  "reports.autoRecheckThreshold": {
    label: "Signalements avant revérification automatique",
    description: "Nombre de signalements ouverts à partir duquel un contexte publié passe automatiquement « à revérifier ».",
    schema: z.number().int().min(1).max(50),
    default: 3,
    unit: "signalements",
  },
  "watch.maxFailures": {
    label: "Échecs de la veille avant revérification",
    description: "Nombre de vérifications consécutives où la documentation source est injoignable avant de passer le contexte « à revérifier ».",
    schema: z.number().int().min(1).max(10),
    default: 3,
    unit: "échecs",
  },
  "security.scanOnSubmit": {
    label: "Analyse de sécurité à chaque contribution",
    description: "Analyse automatiquement chaque contexte soumis ou corrigé (URL suspectes, caractères invisibles, secrets dans l'historique). Les secrets dans le contenu sont bloqués dans tous les cas.",
    schema: z.boolean(),
    default: true,
    unit: null,
  },
  "impact.minutesSavedPerUse": {
    label: "Minutes économisées par copie ou installation (estimation)",
    description: "Hypothèse utilisée pour estimer le temps gagné par les développeurs. Ce n'est pas une mesure : la valeur s'affiche toujours comme une estimation.",
    schema: z.number().int().min(0).max(240),
    default: 25,
    unit: "minutes",
  },
} as const

export type SettingKey = keyof typeof SETTINGS
export type Settings = { [K in SettingKey]: (typeof SETTINGS)[K]["default"] extends boolean ? boolean : number }

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[]

export const settingUpdateSchema = z.object({
  key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]),
  value: z.union([z.number(), z.boolean()]),
})

function defaults(): Settings {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTINGS[k].default])) as Settings
}

export const settingsService = {
  /** Valeurs effectives : enregistrées et valides, sinon par défaut. */
  async all(): Promise<Settings> {
    const rows = await prisma.platformSetting.findMany()
    const out = defaults() as Record<SettingKey, number | boolean>
    for (const r of rows) {
      if (!(r.key in SETTINGS)) continue
      const parsed = SETTINGS[r.key as SettingKey].schema.safeParse(r.value)
      if (parsed.success) out[r.key as SettingKey] = parsed.data
    }
    return out as Settings
  },

  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    const row = await prisma.platformSetting.findUnique({ where: { key } })
    const parsed = row ? SETTINGS[key].schema.safeParse(row.value) : null
    return (parsed?.success ? parsed.data : SETTINGS[key].default) as Settings[K]
  },

  /** Détail pour la page Paramètres : valeur, défaut, dernière modification. */
  async describe() {
    const [values, rows] = await Promise.all([settingsService.all(), prisma.platformSetting.findMany()])
    return SETTING_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key)
      return {
        key,
        label: SETTINGS[key].label,
        description: SETTINGS[key].description,
        unit: SETTINGS[key].unit,
        value: values[key],
        default: SETTINGS[key].default,
        type: typeof SETTINGS[key].default as "number" | "boolean",
        updatedAt: row?.updatedAt ?? null,
        updatedById: row?.updatedById ?? null,
      }
    })
  },

  /** Validation stricte côté serveur ; renvoie l'ancienne et la nouvelle valeur pour le journal. */
  async update(input: unknown, actorId: string) {
    const { key, value } = settingUpdateSchema.parse(input)
    const parsed = SETTINGS[key].schema.safeParse(value)
    if (!parsed.success) throw new HttpError(400, `Valeur invalide pour « ${SETTINGS[key].label} » : ${parsed.error.issues[0]?.message ?? "format incorrect"}.`)
    const before = await settingsService.get(key)
    await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
      update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
    })
    return { key, before, after: parsed.data }
  },
}

/**
 * Configuration contrôlée par le déploiement : seule la présence est affichée, jamais la valeur.
 * Ces réglages ne sont pas modifiables depuis l'interface.
 */
export function deploymentStatus() {
  const set = (...names: string[]) => names.every((n) => Boolean(process.env[n]))
  return [
    { label: "Environnement", value: process.env.NODE_ENV ?? "development", kind: "text" as const },
    { label: "URL publique du site", value: process.env.NEXT_PUBLIC_APP_URL ?? "non définie", kind: "text" as const },
    { label: "Secret de session (AUTH_SECRET)", value: set("AUTH_SECRET"), kind: "flag" as const },
    { label: "Connexion GitHub", value: set("AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"), kind: "flag" as const },
    { label: "Connexion Google", value: set("AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"), kind: "flag" as const },
    { label: "Jeton des tâches planifiées (CRON_SECRET)", value: set("CRON_SECRET"), kind: "flag" as const },
    { label: "Fournisseur IA (capture de preuves)", value: set("AI_API_KEY"), kind: "flag" as const },
    { label: "Sandbox des API simulées (SANDBOX_URL)", value: set("SANDBOX_URL"), kind: "flag" as const },
    {
      label: "Requêtes vers des adresses internes (ALLOW_PRIVATE_FETCH)",
      value: process.env.ALLOW_PRIVATE_FETCH === "true",
      kind: "flag" as const,
      // Activé en production, la protection SSRF de la veille est désactivée
      warnWhenOn: true,
    },
  ]
}
