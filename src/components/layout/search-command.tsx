"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command as CommandPrimitive } from "cmdk"
import { ArrowRightIcon, BookOpenIcon, CornerDownLeftIcon, LayoutGridIcon, Loader2Icon, PlusCircleIcon, SearchIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { ServiceLogo } from "@/components/contexts/service-logo"
import { SERVICE_BRANDS } from "@/config/services"
import { cn } from "@/lib/utils"

type Result = { slug: string; title: string; service: string; countries: string[]; description: string }

const groupClass =
  "px-2 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
const itemClass =
  "group/item flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"

const shortcuts = [
  { label: "Tout le catalogue", href: "/contexts", Icon: LayoutGridIcon },
  { label: "Publier un contexte", href: "/submit", Icon: PlusCircleIcon },
  { label: "CLI & formats", href: "/docs", Icon: BookOpenIcon },
]

/** Palette de recherche (⌘K, Ctrl+K ou « / ») : s'ouvre en haut, résultats en direct. */
export function SearchCommand() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [results, setResults] = React.useState<Result[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/contexts?pageSize=6&q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        const json = await res.json()
        setResults(json.data?.items ?? [])
      } catch {
        if (!ctrl.signal.aborted) setResults([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 160)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, open])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const query = q.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rechercher un contexte"
        className="group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border bg-card/70 px-2.5 text-sm whitespace-nowrap text-muted-foreground shadow-xs transition-all hover:border-primary/40 hover:text-foreground hover:shadow-md active:scale-[0.97] lg:w-60 lg:px-3.5"
      >
        <SearchIcon className="size-4 transition-transform group-hover:scale-110" />
        <span className="hidden flex-1 truncate text-left lg:inline">Rechercher…</span>
        <Kbd className="hidden lg:inline-flex">Ctrl K</Kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQ("")
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[10vh] max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-4 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Rechercher un contexte</DialogTitle>
          <DialogDescription className="sr-only">Tapez un service, un pays ou un tag.</DialogDescription>
          <CommandPrimitive shouldFilter={false} loop className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3 border-b px-5">
              {loading ? (
                <Loader2Icon className="size-5 shrink-0 animate-spin text-primary" />
              ) : (
                <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
              <CommandPrimitive.Input
                value={q}
                onValueChange={setQ}
                placeholder="Wave, Orange Money, SMS, Sénégal…"
                className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
              />
              <Kbd className="hidden sm:inline-flex">Échap</Kbd>
            </div>

            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto overscroll-contain py-1">
              {!query && (
                <CommandPrimitive.Group heading="Services" className={groupClass}>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                    {Object.keys(SERVICE_BRANDS).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setQ(name)}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:scale-95"
                      >
                        <ServiceLogo name={name} size="sm" className="size-5! rounded-full" />
                        {name}
                      </button>
                    ))}
                  </div>
                </CommandPrimitive.Group>
              )}

              <CommandPrimitive.Group heading={query ? "Contextes" : "Les plus installés"} className={groupClass}>
                {results.map((r) => (
                  <CommandPrimitive.Item key={r.slug} value={r.slug} onSelect={() => go(`/contexts/${r.slug}`)} className={itemClass}>
                    <ServiceLogo name={r.service} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.service} · {r.countries.join(", ")}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-4 -translate-x-1 opacity-0 transition-all group-data-[selected=true]/item:translate-x-0 group-data-[selected=true]/item:opacity-100" />
                  </CommandPrimitive.Item>
                ))}
                {!loading && results.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun contexte pour « {query} ».</p>
                )}
              </CommandPrimitive.Group>

              <CommandPrimitive.Group heading="Aller à" className={groupClass}>
                {query && (
                  <CommandPrimitive.Item value="__all" onSelect={() => go(`/contexts?q=${encodeURIComponent(query)}`)} className={itemClass}>
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <span className="flex-1">Tous les résultats pour « {query} »</span>
                  </CommandPrimitive.Item>
                )}
                {shortcuts.map(({ label, href, Icon }) => (
                  <CommandPrimitive.Item key={href} value={href} onSelect={() => go(href)} className={itemClass}>
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>

            <div className={cn("flex items-center gap-4 border-t bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground")}>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> naviguer
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeftIcon />
                </Kbd>
                ouvrir
              </span>
            </div>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  )
}
