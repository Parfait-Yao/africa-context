import { Suspense } from "react"
import { connection } from "next/server"
import type { Metadata } from "next"
import Link from "next/link"
import { SearchXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { CatalogFilters, SortControl } from "@/components/contexts/catalog-filters"
import { ContextCard } from "@/components/contexts/context-card"
import { contextService } from "@/modules/contexts/context.service"
import { CONTEXT_TYPES, type ContextType } from "@/modules/contexts/context.types"
import { countryName, categoryLabel } from "@/config/site"

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Recherchez un contexte IA vérifié par service, pays, format ou tag.",
}

type SearchParams = Record<string, string | string[] | undefined>

export default function CatalogPage({ searchParams }: PageProps<"/contexts">) {
  return (
    <div className="container-page py-10 lg:py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Catalogue des contextes</h1>
        <p className="mt-3 text-muted-foreground">
          Seuls les contextes validés par la modération apparaissent ici. Chaque fiche indique sa source et sa date de vérification.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside aria-label="Filtres" className="lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <Filters />
          </Suspense>
        </aside>
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function Filters() {
  await connection()
  const facets = await contextService.facets()
  return <CatalogFilters tags={facets.tags} />
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const type = one(sp.type)
  const filters = {
    q: one(sp.q),
    country: one(sp.country),
    category: one(sp.category),
    tag: one(sp.tag),
    type: CONTEXT_TYPES.includes(type as ContextType) ? (type as ContextType) : undefined,
    sort: one(sp.sort) as "popular" | "recent" | "verified" | undefined,
    page: Number(one(sp.page) ?? 1) || 1,
    pageSize: 9,
  }
  const result = await contextService.list(filters)

  const summary = [
    filters.q && `« ${filters.q} »`,
    filters.country && countryName(filters.country),
    filters.category && categoryLabel(filters.category),
    filters.tag && `#${filters.tag}`,
  ].filter(Boolean)

  return (
    <section aria-live="polite" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{result.total}</span> contexte{result.total > 1 ? "s" : ""}
          {summary.length > 0 && <> pour {summary.join(", ")}</>}
        </p>
        <div className="hidden lg:block">
          <SortControl />
        </div>
      </div>

      {result.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
            <EmptyTitle>Aucun contexte ne correspond</EmptyTitle>
            <EmptyDescription>Élargissez la recherche, ou publiez le contexte qui manque : d'autres développeurs le cherchent sûrement.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button asChild variant="outline"><Link href="/contexts">Voir tout le catalogue</Link></Button>
            <Button asChild><Link href="/submit">Publier un contexte</Link></Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((c) => (
            <li key={c.slug}><ContextCard context={c} /></li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((p) => {
            const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])))
            next.set("page", String(p))
            return (
              <Button key={p} asChild size="icon-sm" variant={p === result.page ? "default" : "outline"}>
                <Link href={`/contexts?${next.toString()}`} aria-current={p === result.page ? "page" : undefined}>{p}</Link>
              </Button>
            )
          })}
        </nav>
      )}
    </section>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  )
}
