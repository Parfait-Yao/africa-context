"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SearchForm({ defaultValue = "", className, size = "lg" }: { defaultValue?: string; className?: string; size?: "lg" | "default" }) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaultValue)

  return (
    <form
      role="search"
      className={cn("flex w-full items-center gap-2 rounded-xl border bg-card p-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring/40", className)}
      onSubmit={(e) => {
        e.preventDefault()
        router.push(q.trim() ? `/contexts?q=${encodeURIComponent(q.trim())}` : "/contexts")
      }}
    >
      <SearchIcon className="ml-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="hero-search" className="sr-only">Rechercher un service, un pays ou un tag</label>
      <input
        id="hero-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Wave, Orange Money, SMS, Sénégal…"
        className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground", size === "lg" ? "h-11 text-base" : "h-9 text-sm")}
        autoComplete="off"
      />
      <Button type="submit" size={size === "lg" ? "lg" : "default"}>Rechercher</Button>
    </form>
  )
}
