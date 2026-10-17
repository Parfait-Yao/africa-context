"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileStackIcon, PlusIcon, ShieldCheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/dashboard", label: "Mes contributions", Icon: FileStackIcon },
  { href: "/submit", label: "Publier un contexte", Icon: PlusIcon },
  { href: "/admin", label: "Modération", Icon: ShieldCheckIcon, admin: true },
]

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Espace connecté" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.filter((i) => !i.admin || isAdmin).map(({ href, label, Icon, admin }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-secondary text-foreground"
                )}
              >
                <Icon className="size-4" /> {label}
                {admin && <span className="ml-auto hidden text-xs font-normal text-muted-foreground lg:inline">admin</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
