import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { catalogService } from "@/modules/admin/catalog.service"
import { requireAdminPage } from "@/modules/auth/session"

export const metadata: Metadata = { title: "Pays" }

export default function CountriesPage() {
  return (
    <>
      <AdminPageHeader
        title="Pays"
        description="Liste de référence proposée aux contributeurs (codes ISO 3166-1). Elle est définie dans src/config/site.ts : un ajout passe par le code, pour garder des noms et des codes cohérents."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <CountriesContent />
      </Suspense>
    </>
  )
}

async function CountriesContent() {
  await connection()
  await requireAdminPage("/admin/countries")
  const { reference, unknown } = await catalogService.countries()

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Pays</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Publiés</TableHead>
              <TableHead className="pr-5 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reference.map((c) => (
              <TableRow key={c.code}>
                <TableCell className="pl-5">
                  {c.total > 0 ? <Link href={`/admin/contexts?country=${c.code}`} className="font-medium hover:underline">{c.name}</Link> : <span>{c.name}</span>}
                </TableCell>
                <TableCell className="font-mono text-sm">{c.code}</TableCell>
                <TableCell className="text-right tabular-nums">{c.published}</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{c.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {unknown.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          <h2 className="font-semibold">Codes hors liste de référence</h2>
          <p className="mt-1 text-muted-foreground">Utilisés par des contextes mais absents de la liste : à ajouter dans le code ou à corriger sur les contextes concernés.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unknown.map((c) => (
              <li key={c.code}>
                <Link href={`/admin/contexts?country=${c.code}`} className="font-mono hover:underline">{c.code}</Link> ({c.total})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
