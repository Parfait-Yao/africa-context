import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { UsersIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { FilterBar } from "@/components/admin/filter-bar"
import { adminUserFiltersSchema, adminUsersService } from "@/modules/admin/admin-users.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Utilisateurs" }

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminPageHeader title="Utilisateurs" description="Comptes inscrits, rôles et état. Ouvrez une fiche pour changer un rôle ou suspendre un compte." />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function UsersContent({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/users")
  const params = pickParams(await searchParams)
  const result = await adminUsersService.list(adminUserFiltersSchema.parse(params))

  return (
    <>
      <FilterBar
        action="/admin/users"
        values={params}
        fields={[
          { kind: "search", name: "q", label: "Recherche", placeholder: "Nom ou email" },
          { kind: "select", name: "role", label: "Rôle", options: [{ value: "user", label: "Contributeur" }, { value: "admin", label: "Administrateur" }] },
          { kind: "select", name: "state", label: "État", options: [{ value: "active", label: "Actif" }, { value: "suspended", label: "Suspendu" }] },
          {
            kind: "select",
            name: "provider",
            label: "Connexion",
            allLabel: "Toutes",
            options: [{ value: "password", label: "Mot de passe" }, { value: "github", label: "GitHub" }, { value: "google", label: "Google" }],
          },
          {
            kind: "select",
            name: "sort",
            label: "Tri",
            allLabel: "Inscription récente",
            options: [{ value: "name", label: "Nom (A → Z)" }, { value: "reputation", label: "Réputation" }],
          },
        ]}
      />
      {result.items.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><UsersIcon /></EmptyMedia>
            <EmptyTitle>Aucun utilisateur</EmptyTitle>
            <EmptyDescription>Aucun compte ne correspond à ces filtres.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="hidden md:table-cell">Connexion</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Contextes</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Réputation</TableHead>
                <TableHead className="hidden pr-5 lg:table-cell">Inscrit le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-[16rem] pl-5 whitespace-normal">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "Admin" : "Contributeur"}</Badge>
                      {u.suspendedAt && <Badge variant="destructive">Suspendu</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{u.providers.join(", ") || "—"}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{u._count.contexts}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNumber(u.reputationScore)}</TableCell>
                  <TableCell className="hidden pr-5 text-muted-foreground lg:table-cell">{formatDate(u.createdAt.toISOString())}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/users" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
