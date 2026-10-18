import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import {
  ArrowRightIcon, BadgeCheckIcon, CircleCheckIcon, ClockIcon, FlagIcon, InboxIcon, LibraryBigIcon,
  RefreshCwIcon, ScrollTextIcon, TriangleAlertIcon, UsersIcon, ZapIcon, type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { StatusBadge } from "@/components/contexts/status-badge"
import { adminService, type AdminOverview } from "@/modules/admin/admin.service"
import { requireAdminPage } from "@/modules/auth/session"
import { STATUS_LABELS } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Tableau de bord" }

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader title="Tableau de bord" description="État du catalogue et de la modération, en temps réel.">
        <Button asChild>
          <Link href="/admin/moderation"><InboxIcon /> Traiter les contributions</Link>
        </Button>
      </AdminPageHeader>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

async function DashboardContent() {
  await connection()
  await requireAdminPage("/admin")
  const data = await adminService.overview()

  return (
    <div className="space-y-6">
      <StatsGrid data={data} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Alerts data={data} />
        <QuickActions />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentSubmissions items={data.recentSubmissions} />
        <RecentDecisions items={data.recentDecisions} />
      </div>
    </div>
  )
}

function Stat({ label, value, hint, Icon, href, tone }: { label: string; value: number; hint?: string; Icon: LucideIcon; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <Card className={cn("h-full gap-2 py-5 transition-colors", href && "hover:border-primary/40")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
        <CardDescription className="font-medium">{label}</CardDescription>
        <Icon className={cn("size-4 text-muted-foreground", tone === "warning" && "text-warning", tone === "danger" && "text-destructive")} aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-3xl font-bold tracking-tight tabular-nums">{formatNumber(value)}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>
  ) : (
    body
  )
}

function StatsGrid({ data }: { data: AdminOverview }) {
  const { contexts, impact } = data
  return (
    <section aria-labelledby="stats-title">
      <h2 id="stats-title" className="sr-only">Statistiques</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Contextes vérifiés" value={contexts.approved} hint={`${formatNumber(contexts.total)} au total, ${formatNumber(contexts.rejected)} rejetés`} Icon={BadgeCheckIcon} />
        <Stat label="En attente" value={contexts.pending} hint="Soumissions à relire" Icon={ClockIcon} href="/admin/moderation" tone={contexts.pending ? "warning" : undefined} />
        <Stat label="À revérifier" value={contexts.toRecheck} hint="Source modifiée ou signalée" Icon={RefreshCwIcon} href="/admin/moderation" tone={contexts.toRecheck ? "warning" : undefined} />
        <Stat label="Signalements ouverts" value={data.openReports} Icon={FlagIcon} href="/admin/reports" tone={data.openReports ? "danger" : undefined} />
        <Stat label="Utilisateurs" value={data.users} hint={`dont ${formatNumber(data.admins)} administrateur${data.admins > 1 ? "s" : ""}`} Icon={UsersIcon} />
        <Stat label="Services couverts" value={impact.services} hint={`${formatNumber(impact.countries)} pays`} Icon={LibraryBigIcon} />
        <Stat label="Copies" value={impact.copies} hint="Contextes copiés depuis le site" Icon={ZapIcon} />
        <Stat label="Installations" value={impact.installs} hint={`≈ ${formatNumber(impact.hoursSaved)} h gagnées (estimation : ${impact.minutesPerUse} min / usage)`} Icon={ZapIcon} />
      </div>
    </section>
  )
}

function Alerts({ data }: { data: AdminOverview }) {
  const alerts = [
    data.contexts.pending > 0 && { href: "/admin/moderation", text: `${data.contexts.pending} contribution${data.contexts.pending > 1 ? "s" : ""} en attente de relecture` },
    data.contexts.toRecheck > 0 && { href: "/admin/moderation", text: `${data.contexts.toRecheck} contexte${data.contexts.toRecheck > 1 ? "s" : ""} à revérifier` },
    data.openReports > 0 && { href: "/admin/reports", text: `${data.openReports} signalement${data.openReports > 1 ? "s" : ""} ouvert${data.openReports > 1 ? "s" : ""}` },
    data.unreachableSources > 0 && { href: "/admin/sources?state=unreachable", text: `${data.unreachableSources} contexte${data.unreachableSources > 1 ? "s" : ""} publié${data.unreachableSources > 1 ? "s" : ""} dont la documentation source est injoignable` },
    data.openAlerts.total > 0 && {
      href: "/admin/security",
      text: `${data.openAlerts.total} alerte${data.openAlerts.total > 1 ? "s" : ""} de sécurité active${data.openAlerts.total > 1 ? "s" : ""}${data.openAlerts.high ? `, dont ${data.openAlerts.high} de gravité élevée` : ""}`,
    },
  ].filter((a): a is { href: string; text: string } => Boolean(a))

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Alertes</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4 text-success" aria-hidden="true" /> Rien à signaler : modération, signalements et sécurité sont à jour.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.text}>
                {a.href ? (
                  <Link href={a.href} className="group flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm hover:underline">
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="flex-1">{a.text}</span>
                    <ArrowRightIcon className="size-4 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm">
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    {a.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const actions = [
    { href: "/admin/moderation", label: "Relire les contributions", Icon: InboxIcon },
    { href: "/admin/reports", label: "Traiter les signalements", Icon: FlagIcon },
    { href: "/contexts", label: "Voir le catalogue public", Icon: LibraryBigIcon },
    { href: "/admin/audit", label: "Consulter le journal", Icon: ScrollTextIcon },
  ]
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Actions rapides</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 px-3">
        {actions.map(({ href, label, Icon }) => (
          <Button key={href} asChild variant="ghost" className="justify-start">
            <Link href={href}><Icon /> {label}</Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

function EmptyBlock({ title, description, Icon }: { title: string; description: string; Icon: LucideIcon }) {
  return (
    <Empty className="border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function RecentSubmissions({ items }: { items: AdminOverview["recentSubmissions"] }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Dernières soumissions</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <EmptyBlock title="Aucune soumission" description="Les contextes proposés par la communauté apparaîtront ici." Icon={InboxIcon} />
        ) : (
          <ul className="divide-y text-sm">
            {items.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">{c.author.name} · {formatDate(c.createdAt.toISOString())}</span>
                </span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RecentDecisions({ items }: { items: AdminOverview["recentDecisions"] }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="flex flex-row items-center justify-between px-5">
        <CardTitle className="text-base">Dernières décisions</CardTitle>
        {items.length > 0 && (
          <Link href="/admin/audit" className="text-sm text-primary hover:underline">Tout voir</Link>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <EmptyBlock title="Aucune décision" description="Les approbations et rejets seront journalisés ici." Icon={ScrollTextIcon} />
        ) : (
          <ul className="divide-y text-sm">
            {items.map((l) => (
              <li key={l.id} className="px-5 py-2.5">
                <p className="truncate">
                  <span className="font-medium">{l.context.title}</span> → {STATUS_LABELS[l.toStatus]}
                </p>
                <p className="text-xs text-muted-foreground">{l.admin.name} · {formatDate(l.createdAt.toISOString())}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
