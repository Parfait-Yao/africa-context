import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { UserStarIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { adminUserFiltersSchema, adminUsersService } from "@/modules/admin/admin-users.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Contributeurs" }

export default function ContributorsPage({ searchParams }: PageProps<"/admin/contributors">) {
  return (
    <>
      <AdminPageHeader title="Contributeurs" description="Comptes ayant soumis au moins un contexte, avec le devenir de leurs contributions." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ContributorsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function ContributorsContent({ searchParams }: Pick<PageProps<"/admin/contributors">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/contributors")
  const params = pickParams(await searchParams)
  // Classement par réputation par défaut
  const filters = adminUserFiltersSchema.parse({ sort: "reputation", ...params })
  const result = await adminUsersService.list(filters, { contributorsOnly: true })
  const byStatus = await adminUsersService.contributionsByStatus(result.items.map((u) => u.id))

  return (
    <>
      <FilterBar
        action="/admin/contributors"
        values={params}
        fields={[
          { kind: "search", name: "q", label: "Recherche", placeholder: "Nom ou email" },
          {
            kind: "select",
            name: "sort",
            label: "Tri",
            allLabel: "Réputation",
            options: [{ value: "name", label: "Nom (A → Z)" }, { value: "recent", label: "Inscription récente" }],
          },
        ]}
      />
      {result.items.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><UserStarIcon /></EmptyMedia>
            <EmptyTitle>Aucun contributeur</EmptyTitle>
            <EmptyDescription>Personne n'a encore soumis de contexte avec ces critères.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Contributeur</TableHead>
                <TableHead className="text-right">Réputation</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Publiés</TableHead>
                <TableHead className="hidden text-right sm:table-cell">En attente</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">Rejetés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((u) => {
                const s = byStatus.get(u.id) ?? {}
                return (
                  <TableRow key={u.id}>
                    <TableCell className="pl-5">
                      <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name}</Link>
                      {u.suspendedAt && <span className="ml-2 text-xs text-destructive">suspendu</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(u.reputationScore)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{(s.approved ?? 0) + (s.to_recheck ?? 0)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.pending ?? 0}</TableCell>
                    <TableCell className="hidden pr-5 text-right tabular-nums sm:table-cell">{s.rejected ?? 0}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/contributors" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
