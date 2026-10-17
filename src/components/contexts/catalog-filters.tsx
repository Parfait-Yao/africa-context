"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { CATEGORIES, CONTEXT_TYPE_LABELS, COUNTRIES } from "@/config/site"

/**
 * Filtres du catalogue. L'état vit dans l'URL (?q=&country=…) :
 * les résultats sont partageables et rendus côté serveur.
 */
export function CatalogFilters({ tags }: { tags: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete("page")
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router]
  )

  const active = ["country", "type", "category", "tag"].filter((k) => params.get(k))

  const selects = (
    <div className="grid gap-4">
      <FilterSelect id="f-country" label="Pays" value={params.get("country") ?? ""} onChange={(v) => update("country", v)}
        options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
      <FilterSelect id="f-category" label="Catégorie" value={params.get("category") ?? ""} onChange={(v) => update("category", v)}
        options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
      <FilterSelect id="f-type" label="Format" value={params.get("type") ?? ""} onChange={(v) => update("type", v)}
        options={Object.entries(CONTEXT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      <FilterSelect id="f-tag" label="Tag" value={params.get("tag") ?? ""} onChange={(v) => update("tag", v)}
        options={tags.map((t) => ({ value: t, label: t }))} />
    </div>
  )

  return (
    <div className="space-y-4">
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          update("q", q.trim() || null)
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Rechercher"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Service, pays, tag…"
          className="h-10 bg-card pl-9"
        />
      </form>

      {/* Desktop : colonne de filtres */}
      <div className="hidden lg:block">{selects}</div>

      {/* Mobile : filtres dans un panneau */}
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1">
              <SlidersHorizontalIcon /> Filtres{active.length > 0 && ` (${active.length})`}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
            <SheetHeader><SheetTitle>Filtrer les contextes</SheetTitle></SheetHeader>
            <div className="px-4">{selects}</div>
            <SheetFooter>
              <SheetClose asChild><Button>Voir les résultats</Button></SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <SortSelect value={params.get("sort") ?? "popular"} onChange={(v) => update("sort", v === "popular" ? null : v)} />
      </div>

      {active.length > 0 && (
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname)}>
          <XIcon /> Effacer les filtres
        </Button>
      )}
    </div>
  )
}

export function SortControl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <SortSelect
      value={params.get("sort") ?? "popular"}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString())
        if (v === "popular") next.delete("sort")
        else next.set("sort", v)
        router.push(`${pathname}?${next.toString()}`, { scroll: false })
      }}
    />
  )
}

function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <NativeSelect aria-label="Trier" value={value} onChange={(e) => onChange(e.target.value)} className="bg-card">
      <NativeSelectOption value="popular">Les plus installés</NativeSelectOption>
      <NativeSelectOption value="verified">Vérifiés récemment</NativeSelectOption>
      <NativeSelectOption value="recent">Ajoutés récemment</NativeSelectOption>
    </NativeSelect>
  )
}

function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string | null) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value || null)} className="w-full bg-card" wrapperClassName="w-full">
        <NativeSelectOption value="">Tous</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
