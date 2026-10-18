import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import Link from "next/link"
import { ExternalLinkIcon, FileSearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ModerationReview, type ReviewData } from "@/components/admin/moderation-review"
import { contextService } from "@/modules/contexts/context.service"
import { requireAdminPage } from "@/modules/auth/session"
import { REQUIRED_SECTIONS, checkSections } from "@/modules/spec/spec.schema"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { runContextChecks, summarizeChecks } from "@/modules/spec/context-checks"
import { CONTEXT_TYPE_LABELS } from "@/config/site"
import type { Context } from "@/modules/contexts/context.types"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Contributions en attente" }

export default function ModerationPage() {
  return (
    <>
      <AdminPageHeader title="Contributions en attente" description="Vérifiez chaque soumission sur sa documentation officielle avant de l'approuver." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ModerationContent />
      </Suspense>
    </>
  )
}

function toReview(c: Context): ReviewData {
  const { present } = checkSections(c.content)
  return {
    slug: c.slug,
    title: c.title,
    status: c.status,
    sourceUrl: c.sourceUrl,
    author: c.author.name,
    content: c.content,
    sections: REQUIRED_SECTIONS.map((s) => ({ title: s.title, ok: present.includes(s.key) })),
    secrets: scanForSecrets(c.content).map(({ label, excerpt, line }) => ({ label, excerpt, line })),
  }
}

/** Rendu à la requête : les statuts changent après chaque décision. */
async function ModerationContent() {
  await connection()
  await requireAdminPage("/admin/moderation")

  const items = await contextService.listForModeration()
  const pending = items.filter((c) => c.status === "pending")
  const recheck = items.filter((c) => c.status === "to_recheck")

  return (
    <Tabs defaultValue="pending">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="pending">En attente <Badge variant="secondary">{pending.length}</Badge></TabsTrigger>
        <TabsTrigger value="recheck">À revérifier <Badge variant="secondary">{recheck.length}</Badge></TabsTrigger>
      </TabsList>

      {[{ value: "pending", rows: pending }, { value: "recheck", rows: recheck }].map(({ value, rows }) => (
        <TabsContent key={value} value={value} className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Contexte</TableHead>
                  <TableHead className="hidden lg:table-cell">Service · version</TableHead>
                  <TableHead className="hidden md:table-cell">Contributeur</TableHead>
                  <TableHead className="hidden sm:table-cell">Validation</TableHead>
                  <TableHead className="hidden md:table-cell">Soumis le</TableHead>
                  <TableHead className="pr-5 text-right">Décision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Rien à traiter pour l'instant.</TableCell></TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.slug}>
                    <TableCell className="max-w-[16rem] pl-5 whitespace-normal">
                      <p className="font-medium">{c.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{CONTEXT_TYPE_LABELS[c.type]}</span>
                        <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          Source <ExternalLinkIcon className="size-3" />
                        </a>
                      </p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{c.service} <span className="text-muted-foreground">· {c.apiVersion}</span></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/admin/users/${c.author.id}`} className="hover:underline">{c.author.name}</Link>
                      <p className="text-xs text-muted-foreground">Réputation {c.author.reputationScore}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><ValidationSummary c={c} /></TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(c.createdAt)}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <ModerationReview data={toReview(c)} />
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/contexts/${c.slug}`}><FileSearchIcon /> Examiner</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Résumé des contrôles techniques (détail complet sur la fiche du contexte). */
function ValidationSummary({ c }: { c: Context }) {
  const { errors, warnings, blocking } = summarizeChecks(runContextChecks(c))
  if (!errors && !warnings) return <span className="text-xs text-success">Conforme</span>
  return (
    <span className={blocking ? "text-xs text-destructive" : "text-xs text-warning"}>
      {errors} erreur{errors > 1 ? "s" : ""}, {warnings} avert.{blocking && " · bloquant"}
    </span>
  )
}
