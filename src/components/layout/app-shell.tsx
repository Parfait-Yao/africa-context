import { Suspense } from "react"
import { SiteHeader } from "./site-header"
import { connection } from "next/server"
import { AppNav } from "./app-nav"
import { getSession } from "@/modules/auth/session"

async function NavWithRole() {
  await connection()
  const user = await getSession()
  return <AppNav isAdmin={user?.role === "admin"} />
}

/** Coque des espaces connectés (contributeur, administrateur). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="container-page grid grid-cols-1 flex-1 gap-8 py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-10">
        <Suspense fallback={<div className="h-10" />}>
          <NavWithRole />
        </Suspense>
        <main id="contenu" className="min-w-0">{children}</main>
      </div>
    </>
  )
}
