import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { RenameServiceButton } from "@/components/admin/catalog-actions"
import { ServiceLogo } from "@/components/contexts/service-logo"
import { catalogService } from "@/modules/admin/catalog.service"
import { requireAdminPage } from "@/modules/auth/session"

export const metadata: Metadata = { title: "Services" }

export default function ServicesPage() {
  return (
    <>
      <AdminPageHeader
        title="Services"
        description="Le service est saisi librement par chaque contributeur : renommez-le pour corriger une variante (ex. « Orange money ») ou fusionner deux noms. Les logos se déclarent dans src/config/services.ts."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ServicesContent />
      </Suspense>
    </>
  )
}

async function ServicesContent() {
  await connection()
  await requireAdminPage("/admin/services")
  const services = await catalogService.services()
  const names = services.map((s) => s.name)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Service</TableHead>
            <TableHead className="text-right">Publiés</TableHead>
            <TableHead className="hidden text-right sm:table-cell">En attente</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.name}>
              <TableCell className="pl-5">
                <span className="flex items-center gap-2">
                  <ServiceLogo name={s.name} size="sm" />
                  <Link href={`/admin/contexts?service=${encodeURIComponent(s.name)}`} className="font-medium hover:underline">{s.name}</Link>
                  {!s.hasLogo && <span className="text-xs text-muted-foreground">sans logo</span>}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{s.published}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.pending}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.total}</TableCell>
              <TableCell className="pr-5 text-right">
                {s.total > 0 ? (
                  <RenameServiceButton name={s.name} uses={s.total} existing={names.filter((n) => n !== s.name)} />
                ) : (
                  <span className="text-xs text-muted-foreground">Logo prévu, aucun contexte</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
