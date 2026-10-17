import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { PencilIcon, PlusIcon, TrophyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/contexts/status-badge"
import { contextService } from "@/modules/contexts/context.service"
import { usersService } from "@/modules/users/users.service"
import { getSession } from "@/modules/auth/session"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Mes contributions" }

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <DashboardContent />
    </Suspense>
  )
}

async function DashboardContent() {
  await connection()
  const user = await getSession()
  if (!user) redirect("/login?callbackUrl=/dashboard")

  const [mine, me, leaders] = await Promise.all([
    contextService.listByAuthor(user.id),
    usersService.findById(user.id),
    usersService.leaderboard(5),
  ])
  const installs = mine.reduce((s, c) => s + c.stats.installs, 0)
  const copies = mine.reduce((s, c) => s + c.stats.copies, 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mes contributions</h1>
          <p className="mt-1 text-muted-foreground">Bonjour {user.name || user.email}. Suivez la validation et l'usage de vos contextes.</p>
        </div>
        <Button asChild><Link href="/submit"><PlusIcon /> Publier un contexte</Link></Button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {[
          { label: "Contextes", value: mine.length },
          { label: "Installations", value: installs },
          { label: "Copies", value: copies },
          { label: "Réputation", value: me?.reputationScore ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-card p-5">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(s.value)}</dd>
          </div>
        ))}
      </dl>

      {mine.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Vous n'avez encore publié aucun contexte.</p>
          <p className="mt-1 text-sm text-muted-foreground">Partagez une intégration que vous maîtrisez : Wave, Orange Money, une API SMS…</p>
          <Button asChild className="mt-4"><Link href="/submit">Publier mon premier contexte</Link></Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Contexte</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Soumis le</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Installations</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((c) => (
                <TableRow key={c.slug} className="align-top">
                  <TableCell className="max-w-[18rem] pl-5 whitespace-normal">
                    {c.status === "approved" || c.status === "to_recheck" ? (
                      <Link href={`/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                    ) : (
                      <span className="font-medium">{c.title}</span>
                    )}
                    <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                    {c.status === "rejected" && c.rejectionReason && (
                      <p className="mt-1.5 text-xs text-destructive">Motif : {c.rejectionReason}</p>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.stats.installs)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button asChild size="sm" variant={c.status === "rejected" ? "default" : "ghost"}>
                      <Link href={`/submit?edit=${c.slug}`}>
                        <PencilIcon /> {c.status === "rejected" ? "Corriger et resoumettre" : "Modifier"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <section aria-labelledby="leaders" className="rounded-xl border bg-card p-5">
        <h2 id="leaders" className="flex items-center gap-2 font-semibold"><TrophyIcon className="size-4 text-warning" /> Meilleurs contributeurs</h2>
        <ol className="mt-3 divide-y text-sm">
          {leaders.map((l, i) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-3">
                <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className={l.id === user.id ? "font-semibold" : ""}>{l.name}</span>
                <span className="text-xs text-muted-foreground">{l._count.contexts} contexte{l._count.contexts > 1 ? "s" : ""}</span>
              </span>
              <span className="font-mono tabular-nums">{l.reputationScore}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">+10 par contexte approuvé, +2 par vote positif reçu, −1 par vote négatif.</p>
      </section>
    </div>
  )
}
