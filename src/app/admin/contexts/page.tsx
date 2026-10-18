import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { FlagIcon, InboxIcon, LibraryBigIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusBadge } from "@/components/contexts/status-badge"
import { adminContextFiltersSchema, adminContextsService, pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { CONTEXT_STATUSES, CONTEXT_TYPES } from "@/modules/contexts/context.types"
import { COUNTRIES, CONTEXT_TYPE_LABELS, STATUS_LABELS } from "@/config/site"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Contextes" }

export default function AdminContextsPage({ searchParams }: PageProps<"/admin/contexts">) {
  return (
    <>
      <AdminPageHeader title="Contextes" description="Tous les contextes, quel que soit leur statut. Les contextes sont publiés par les contributeurs ; l'administration les vérifie et les valide.">
        <Button asChild>
          <Link href="/admin/moderation"><InboxIcon /> File de modération</Link>
        </Button>
      </AdminPageHeader>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
        <ContextsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function ContextsContent({ searchParams }: Pick<PageProps<"/admin/contexts">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/contexts")
  const params = pickParams(await searchParams)
  const filters = adminContextFiltersSchema.parse(params)
  const [result, services] = await Promise.all([adminContextsService.list(filters), adminContextsService.services()])

  return (
    <>
      <FilterBar
        action="/admin/contexts"
        values={params}
        fields={[
          { kind: "search", name: "q", label: "Recherche", placeholder: "Titre, service, slug, mot-clé…" },
          { kind: "select", name: "status", label: "Statut", options: CONTEXT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })) },
          { kind: "select", name: "service", label: "Service", options: services.map((s) => ({ value: s, label: s })) },
          { kind: "select", name: "country", label: "Pays", options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })) },
          { kind: "select", name: "type", label: "Type", options: CONTEXT_TYPES.map((t) => ({ value: t, label: CONTEXT_TYPE_LABELS[t] })) },
          { kind: "date", name: "from", label: "Soumis depuis le" },
          { kind: "date", name: "to", label: "Soumis jusqu'au" },
          {
            kind: "select",
            name: "sort",
            label: "Tri",
            allLabel: "Plus récents",
            options: [
              { value: "oldest", label: "Plus anciens" },
              { value: "updated", label: "Modifiés récemment" },
              { value: "title", label: "Titre (A → Z)" },
            ],
          },
        ]}
      />

      {result.items.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><LibraryBigIcon /></EmptyMedia>
            <EmptyTitle>Aucun contexte</EmptyTitle>
            <EmptyDescription>Aucun contexte ne correspond à ces filtres.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Contexte</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Service · version</TableHead>
                <TableHead className="hidden md:table-cell">Auteur</TableHead>
                <TableHead className="hidden pr-5 md:table-cell">Soumis le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-[18rem] pl-5 whitespace-normal">
                    <Link href={`/admin/contexts/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{c.slug}</span>
                      <span>{CONTEXT_TYPE_LABELS[c.type]}</span>
                      <span>{c._count.versions} version{c._count.versions > 1 ? "s" : ""}</span>
                      {c._count.reports > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive"><FlagIcon className="size-3" /> {c._count.reports} signalement{c._count.reports > 1 ? "s" : ""}</span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.service} <span className="text-muted-foreground">· {c.apiVersion}</span>
                    <p className="text-xs text-muted-foreground">{c.countries.join(", ")}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/admin/users/${c.author.id}`} className="hover:underline">{c.author.name}</Link>
                  </TableCell>
                  <TableCell className="hidden pr-5 text-muted-foreground md:table-cell">{formatDate(c.createdAt.toISOString())}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/contexts" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
