"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LogoMark } from "@/components/layout/logo"
import { cn } from "@/lib/utils"
import { ADMIN_NAV, isActive, type AdminNavItem } from "./admin-nav-items"
import { AdminUserMenu, type AdminUser } from "./admin-user-menu"

const STORAGE_KEY = "africontext:admin-sidebar-collapsed"

/** Infobulle à droite, uniquement quand les libellés sont masqués. */
function WithTooltip({ show, label, children }: { show: boolean; label: string; children: React.ReactElement }) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function NavEntry({ item, collapsed, onNavigate }: { item: AdminNavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { label, href, Icon } = item
  const base = cn(
    "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed && "justify-center px-0"
  )

  if (!href) {
    return (
      <WithTooltip show={collapsed} label={`${label} — bientôt`}>
        <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-muted-foreground/60")}>
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {collapsed ? (
            <span className="sr-only">{label} (bientôt disponible)</span>
          ) : (
            <>
              <span className="truncate">{label}</span>
              <span className="ml-auto rounded-full border px-1.5 py-px text-[0.65rem] font-normal">Bientôt</span>
            </>
          )}
        </span>
      </WithTooltip>
    )
  }

  const active = isActive(pathname, href)
  return (
    <WithTooltip show={collapsed} label={label}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          base,
          "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent font-semibold text-sidebar-primary hover:text-sidebar-primary"
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
      </Link>
    </WithTooltip>
  )
}

function NavGroups({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Administration" className="flex-1 overflow-y-auto px-2 py-3">
      {ADMIN_NAV.map((group, i) => (
        <div key={group.label} className={cn(i > 0 && "mt-4")}>
          {collapsed ? (
            i > 0 && <div className="mx-2 mb-3 border-t border-sidebar-border" role="separator" />
          ) : (
            <p className="mb-1 px-2.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</p>
          )}
          <ul className="space-y-0.5" aria-label={collapsed ? group.label : undefined}>
            {group.items.map((item) => (
              <li key={item.label}>
                <NavEntry item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand({ collapsed = false, gradientId }: { collapsed?: boolean; gradientId: string }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
      <LogoMark className="size-8 shrink-0" gradientId={gradientId} />
      {collapsed ? (
        <span className="sr-only">AfriContext — administration</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block text-[1.05rem] font-bold tracking-tight">
            Afri<span className="font-medium">Context</span>
          </span>
          <span className="block text-xs text-muted-foreground">Administration</span>
        </span>
      )}
    </Link>
  )
}

/** Sidebar ordinateur : ouverte par défaut, réductible en icônes (bouton ou Ctrl/⌘ + B), état mémorisé localement. */
export function AdminSidebar({ user }: { user: AdminUser }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de la préférence au montage
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true)
    } catch {}
  }, [])

  const toggle = useCallback(
    () =>
      setCollapsed((c) => {
        try {
          localStorage.setItem(STORAGE_KEY, c ? "0" : "1")
        } catch {}
        return !c
      }),
    []
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable='true']")
      if (!typing && e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
        {!collapsed && <Brand gradientId="ac-grad-admin-sidebar" />}
        <WithTooltip show label={collapsed ? "Déplier le menu (Ctrl + B)" : "Réduire le menu (Ctrl + B)"}>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8", !collapsed && "ml-auto")}
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
        </WithTooltip>
      </div>
      <NavGroups collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        <AdminUserMenu user={user} placement="sidebar" collapsed={collapsed} />
      </div>
    </aside>
  )
}

/** Menu mobile : tiroir à gauche, refermé après chaque navigation. */
export function AdminMobileNav({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu d'administration">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-3">
          <SheetTitle asChild>
            <div onClick={close}>
              <Brand gradientId="ac-grad-admin-sheet" />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Navigation de l'espace administrateur</SheetDescription>
        </SheetHeader>
        <NavGroups onNavigate={close} />
        <div className="border-t border-sidebar-border p-2">
          <AdminUserMenu user={user} placement="sidebar" onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
