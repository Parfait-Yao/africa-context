import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { CircleCheckIcon, CircleXIcon, LockIcon, TriangleAlertIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { SettingField } from "@/components/admin/setting-field"
import { deploymentStatus, settingsService } from "@/modules/settings/settings.service"
import { requireAdminPage } from "@/modules/auth/session"
import { prisma } from "@/lib/db"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Paramètres" }

export default function SettingsPage() {
  return (
    <>
      <AdminPageHeader title="Paramètres" description="Réglages de la plateforme gérés par l'application. Chaque modification est validée par le serveur et journalisée." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SettingsContent />
      </Suspense>
    </>
  )
}

async function SettingsContent() {
  await connection()
  await requireAdminPage("/admin/settings")
  const settings = await settingsService.describe()
  const editors = await prisma.user.findMany({
    where: { id: { in: settings.map((s) => s.updatedById).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  })
  const deployment = deploymentStatus()
  const prod = process.env.NODE_ENV === "production"

  return (
    <div className="space-y-8">
      <section aria-labelledby="platform-title">
        <h2 id="platform-title" className="mb-3 text-lg font-semibold">Plateforme</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {settings.map((s) => (
            <li key={s.key} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-medium">{s.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.updatedAt
                    ? `Modifié le ${formatDate(s.updatedAt.toISOString())}${s.updatedById ? ` par ${editors.find((e) => e.id === s.updatedById)?.name ?? "un administrateur"}` : ""}`
                    : "Valeur par défaut"}
                  {" · "}
                  <Link href={`/admin/audit?target=${encodeURIComponent(s.key)}`} className="underline-offset-2 hover:underline">historique</Link>
                </p>
              </div>
              <SettingField settingKey={s.key} label={s.label} type={s.type} value={s.value} defaultValue={s.default} unit={s.unit} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deploy-title">
        <h2 id="deploy-title" className="flex items-center gap-2 text-lg font-semibold">
          <LockIcon className="size-4 text-muted-foreground" aria-hidden="true" /> Déploiement (lecture seule)
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Contrôlé par les variables d'environnement du serveur, jamais modifiable ici. Seule la présence d'un secret est indiquée, pas sa valeur.
        </p>
        <dl className="divide-y rounded-xl border bg-card text-sm">
          {deployment.map((d) => {
            const warn = d.kind === "flag" && "warnWhenOn" in d && d.warnWhenOn && d.value === true && prod
            return (
              <div key={d.label} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <dt>{d.label}</dt>
                <dd className="flex items-center gap-1.5 text-muted-foreground">
                  {d.kind === "text" ? (
                    <span className="font-mono text-xs">{String(d.value)}</span>
                  ) : warn ? (
                    <><TriangleAlertIcon className="size-4 text-destructive" aria-hidden="true" /> <span className="text-destructive">Activé en production : protection SSRF désactivée</span></>
                  ) : d.value ? (
                    <><CircleCheckIcon className="size-4 text-success" aria-hidden="true" /> {"warnWhenOn" in d ? "Activé" : "Configuré"}</>
                  ) : (
                    <><CircleXIcon className="size-4" aria-hidden="true" /> {"warnWhenOn" in d ? "Désactivé" : "Non configuré"}</>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      </section>
    </div>
  )
}
