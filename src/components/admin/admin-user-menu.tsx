"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { ChevronsUpDownIcon, HouseIcon, LogOutIcon, MoonIcon, ShieldCheckIcon, SunIcon, UserIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export interface AdminUser {
  id: string
  name: string
  email: string
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "A"
}

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground", className)} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}

/** Raccourcis de la barre du haut (icônes avec infobulle). */
export function AdminTopbarActions() {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" aria-label="Voir le site">
            <Link href="/"><HouseIcon /></Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Voir le site</TooltipContent>
      </Tooltip>
      <ThemeToggle />
    </div>
  )
}

/**
 * Admin connecté : un clic ouvre la carte de profil et ses actions.
 * `placement="sidebar"` : ligne pleine largeur en bas de la barre latérale (carte au-dessus, ou à droite si réduite).
 */
export function AdminUserMenu({
  user,
  placement = "topbar",
  collapsed = false,
  onNavigate,
}: {
  user: AdminUser
  placement?: "topbar" | "sidebar"
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const close = () => {
    setOpen(false)
    onNavigate?.()
  }
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:text-muted-foreground"
  const inSidebar = placement === "sidebar"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {inSidebar ? (
          <button
            type="button"
            aria-label={`Compte de ${user.name}`}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent",
              collapsed && "justify-center px-0"
            )}
          >
            <Initials name={user.name} className="size-8 text-xs" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-sm leading-tight">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <Button variant="ghost" className="h-9 gap-2 rounded-full px-1 sm:pr-3" aria-label={`Compte de ${user.name}`}>
            <Initials name={user.name} className="size-7 text-xs" />
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">{user.name}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={inSidebar ? (collapsed ? "right" : "top") : "bottom"}
        align={inSidebar ? (collapsed ? "end" : "start") : "end"}
        sideOffset={8}
        className={cn("p-0", inSidebar && !collapsed ? "w-(--radix-popover-trigger-width) min-w-60" : "w-72")}
      >
        <div className="flex items-center gap-3 p-4">
          <Initials name={user.name} className="size-11 text-base" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <Badge className="mt-1.5 gap-1"><ShieldCheckIcon /> Administrateur</Badge>
          </div>
        </div>
        <Separator />
        <nav aria-label="Compte" className="grid gap-0.5 p-2">
          <Link href={`/admin/users/${user.id}`} onClick={close} className={item}><UserIcon /> Mon profil</Link>
          <Link href="/" onClick={close} className={item}><HouseIcon /> Voir le site</Link>
          <button type="button" className={item} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <SunIcon className="hidden dark:block" />
            <MoonIcon className="dark:hidden" />
            <span className="dark:hidden">Thème sombre</span>
            <span className="hidden dark:inline">Thème clair</span>
          </button>
        </nav>
        <Separator />
        <div className="p-2">
          <button type="button" className={`${item} text-destructive hover:bg-destructive/10 [&_svg]:text-destructive`} onClick={() => signOut({ redirectTo: "/" })}>
            <LogOutIcon /> Se déconnecter
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
