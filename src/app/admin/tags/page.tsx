import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { TagsIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { FilterBar } from "@/components/admin/filter-bar"
import { CreateTagButton, TagRowActions } from "@/components/admin/catalog-actions"
import { catalogService } from "@/modules/admin/catalog.service"
import { pickParams } from "@/modules/admin/admin-contexts.service"
import { requireAdminPage } from "@/modules/auth/session"

export const metadata: Metadata = { title: "Tags" }

export default function TagsPage({ searchParams }: PageProps<"/admin/tags">) {
  return (
    <>
      <AdminPageHeader title="Tags" description="Un tag utilisé ne peut pas être supprimé : renommez-le pour corriger une faute ou harmoniser.">
        <CreateTagButton />
      </AdminPageHeader>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <TagsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function TagsContent({ searchParams }: Pick<PageProps<"/admin/tags">, "searchParams">) {
  await connection()
  await requireAdminPage("/admin/tags")
  const params = pickParams(await searchParams)
  const tags = await catalogService.tags(params.q?.slice(0, 50))

  return (
    <>
      <FilterBar action="/admin/tags" values={params} fields={[{ kind: "search", name: "q", label: "Recherche", placeholder: "Nom du tag" }]} />
      {tags.length === 0 ? (
        <Empty className="rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><TagsIcon /></EmptyMedia>
            <EmptyTitle>Aucun tag</EmptyTitle>
            <EmptyDescription>{params.q ? "Aucun tag ne correspond à cette recherche." : "Les tags apparaissent quand des contextes en utilisent."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Tag</TableHead>
                <TableHead className="text-right">Contextes</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-5 font-mono text-sm">{t.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.uses > 0 ? <Link href={`/contexts?tag=${encodeURIComponent(t.name)}`} className="hover:underline">{t.uses}</Link> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="pr-5"><TagRowActions id={t.id} name={t.name} uses={t.uses} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
