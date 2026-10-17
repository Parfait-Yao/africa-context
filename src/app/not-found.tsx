import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/layout/site-header"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-24">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-3xl font-bold tracking-tight">Cette page n'existe pas.</h1>
        <p className="max-w-md text-muted-foreground">
          Le contexte a peut-être été retiré, ou il attend encore la validation d'un administrateur.
        </p>
        <div className="flex gap-2">
          <Button asChild><Link href="/contexts">Parcourir le catalogue</Link></Button>
          <Button asChild variant="outline"><Link href="/">Accueil</Link></Button>
        </div>
      </main>
    </>
  )
}
