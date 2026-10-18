import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { z } from "zod"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { StatusBadge } from "@/components/contexts/status-badge"
import { adminContextsService, pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Versions et historique" }

export default function VersionsPage({ searchParams }: PageProps<"/admin/versions">) {
  return (
    <>
      <AdminPageHeader
        title="Versions et historique"
        description="Chaque soumission et chaque correction crée une version. Le contenu de chaque version se consulte dans l'onglet « Versions » de la fiche du contexte."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <VersionsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function VersionsContent({ searchParams }: Pick<PageProps<"/admin/versions">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/versions")
  const params = pickParams(await searchParams)
  const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(params.page ?? 1)
  const result = await adminContextsService.recentVersions(page)

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card text-sm">
        {result.items.length === 0 && <li className="p-6 text-center text-muted-foreground">Aucune version enregistrée.</li>}
        {result.items.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <span className="min-w-0">
              <Link href={`/admin/contexts/${v.context.slug}`} className="font-medium hover:underline">{v.context.title}</Link>
              <span className="block text-xs text-muted-foreground">{v.note} · {formatDate(v.createdAt.toISOString())}</span>
            </span>
            <StatusBadge status={v.context.status} />
          </li>
        ))}
      </ul>
      <AdminPagination basePath="/admin/versions" params={params} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  )
}
