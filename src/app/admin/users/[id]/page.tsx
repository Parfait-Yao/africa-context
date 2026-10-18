import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UserActions } from "@/components/admin/user-actions"
import { StatusBadge } from "@/components/contexts/status-badge"
import { adminUsersService } from "@/modules/admin/admin-users.service"
import { requireAdminPage } from "@/modules/auth/session"
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Profil utilisateur" }

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/users"><ArrowLeftIcon /> Tous les utilisateurs</Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <UserDetail params={params} />
      </Suspense>
    </>
  )
}

async function UserDetail({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  await connection()
  const { id } = await params
  const admin = await requireAdminPage(`/admin/users/${id}`)
  const data = await adminUsersService.profile(id)
  if (!data) notFound()
  const { user: u, contexts, reports } = data

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "Administrateur" : "Contributeur"}</Badge>
          {u.suspendedAt && <Badge variant="destructive">Suspendu depuis le {formatDate(u.suspendedAt.toISOString())}</Badge>}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{u.name}</h1>
        <p className="text-muted-foreground">{u.email}</p>
        <UserActions
          id={u.id}
          name={u.name}
          email={u.email}
          role={u.role}
          suspended={Boolean(u.suspendedAt)}
          isSelf={u.id === admin.id}
          removable={contexts.length === 0 && u._count.moderationLogs === 0}
        />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Réputation", formatNumber(u.reputationScore)],
          ["Contextes soumis", formatNumber(contexts.length)],
          ["Signalements émis", formatNumber(reports.length)],
          ["Votes", formatNumber(u._count.votes)],
        ].map(([label, value]) => (
          <Card key={label} className="gap-1 py-4">
            <CardHeader className="px-4"><p className="text-sm text-muted-foreground">{label}</p></CardHeader>
            <CardContent className="px-4 text-2xl font-bold tabular-nums">{value}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4"><CardTitle className="text-base">Compte</CardTitle></CardHeader>
        <CardContent className="grid gap-1 px-4 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Connexion :</span> {u.providers.join(", ") || "—"}</p>
          <p><span className="text-muted-foreground">Inscrit le :</span> {formatDate(u.createdAt.toISOString())}</p>
          {u.githubUrl && (
            <p><span className="text-muted-foreground">GitHub :</span> <a href={u.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{u.githubUrl}</a></p>
          )}
          {u.role === "admin" && <p><span className="text-muted-foreground">Décisions de modération :</span> {u._count.moderationLogs}</p>}
        </CardContent>
      </Card>

      <section aria-labelledby="contribs">
        <h2 id="contribs" className="mb-2 text-lg font-semibold">Contributions</h2>
        {contexts.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Aucun contexte soumis.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {contexts.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <Link href={`/admin/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                  <span className="block text-xs text-muted-foreground">{c.service} · {formatDate(c.createdAt.toISOString())}</span>
                </span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reports">
        <h2 id="reports" className="mb-2 text-lg font-semibold">Signalements émis</h2>
        {reports.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Aucun signalement émis.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-medium">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span> sur{" "}
                  <Link href={`/admin/contexts/${r.context.slug}`} className="hover:underline">{r.context.title}</Link>
                </span>
                <span className="text-xs text-muted-foreground">{REPORT_STATUS_LABELS[r.status]} · {formatDate(r.createdAt.toISOString())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
