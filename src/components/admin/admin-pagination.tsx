import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"

/** Pagination par liens (conserve les filtres de l'URL). */
export function AdminPagination({
  basePath,
  params,
  page,
  pageCount,
  total,
}: {
  basePath: string
  params: Record<string, string>
  page: number
  pageCount: number
  total: number
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams(params)
    if (p > 1) sp.set("page", String(p))
    else sp.delete("page")
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {formatNumber(total)} résultat{total > 1 ? "s" : ""} · page {page} sur {pageCount}
      </span>
      {pageCount > 1 && (
        <span className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(page - 1)} rel="prev"><ChevronLeftIcon /> Précédente</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled><ChevronLeftIcon /> Précédente</Button>
          )}
          {page < pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(page + 1)} rel="next">Suivante <ChevronRightIcon /></Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>Suivante <ChevronRightIcon /></Button>
          )}
        </span>
      )}
    </nav>
  )
}
