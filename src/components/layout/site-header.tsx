import { Suspense } from "react"
import { Logo } from "./logo"
import { MainNav, MainNavFallback } from "./main-nav"
import { MobileNav } from "./mobile-nav"
import { ThemeToggle } from "./theme-toggle"
import { SearchCommand } from "./search-command"
import { UserMenu, GuestActions } from "./user-menu"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container-page flex h-16 items-center gap-2">
        <MobileNav />
        <Logo className="mr-4" />
        <Suspense fallback={<MainNavFallback className="hidden items-center gap-1 md:flex" />}>
          <MainNav className="hidden items-center gap-1 md:flex" />
        </Suspense>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchCommand />
          <ThemeToggle />
          <Suspense fallback={<GuestActions />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
