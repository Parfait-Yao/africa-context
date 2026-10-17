import { ViewTransition } from "react"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {/* Transition fluide entre les pages (View Transitions API, sans effet si non supportée) */}
        <ViewTransition enter="page-enter" exit="page-exit" default="none">
          {children}
        </ViewTransition>
      </main>
      <SiteFooter />
    </>
  )
}
