import { Suspense } from "react"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import { LogoMark } from "@/components/layout/logo"
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminTopbarActions, AdminUserMenu } from "@/components/admin/admin-user-menu"
import { getSession } from "@/modules/auth/session"

/**
 * Coque de l'espace administrateur. Elle n'affiche la navigation qu'aux admins, mais ne protège rien :
 * chaque page appelle `requireAdminPage()` (et chaque route API `requireAdmin()`).
 */
async function AdminOnly({ children }: { children: (user: { id: string; name: string; email: string }) => React.ReactNode }) {
  await connection()
  const user = await getSession()
  if (user?.role !== "admin") return null
  return children({ id: user.id, name: user.name, email: user.email })
}

function SidebarFallback() {
  return (
    <div aria-hidden="true" className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar p-3 md:flex">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1">
      <Suspense fallback={<SidebarFallback />}>
        <AdminOnly>{(user) => <AdminSidebar user={user} />}</AdminOnly>
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Suspense fallback={<div className="size-9 md:hidden" />}>
            <AdminOnly>{(user) => <AdminMobileNav user={user} />}</AdminOnly>
          </Suspense>
          <div className="flex items-center gap-2 md:hidden">
            <LogoMark className="size-7" gradientId="ac-grad-admin-header" />
            <span className="font-semibold">Administration</span>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <AdminTopbarActions />
            </div>
            {/* Sur ordinateur, le profil est en bas de la barre latérale ; sur mobile, il reste accessible ici */}
            <div className="md:hidden">
              <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
                <AdminOnly>{(user) => <AdminUserMenu user={user} />}</AdminOnly>
              </Suspense>
            </div>
          </div>
        </header>
        <main id="contenu" className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
