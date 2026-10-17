import Link from "next/link"
import { siteConfig } from "@/config/site"
import { LogoMark } from "./logo"

const columns = [
  {
    title: "Produit",
    links: [
      { label: "Catalogue", href: "/contexts" },
      { label: "Publier un contexte", href: "/submit" },
      { label: "CLI & formats", href: "/docs" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Wave", href: "/contexts?q=wave" },
      { label: "Orange Money", href: "/contexts?q=orange" },
      { label: "FedaPay", href: "/contexts?q=fedapay" },
      { label: "API SMS", href: "/contexts?category=sms" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Se connecter", href: "/login" },
      { label: "Mes contributions", href: "/dashboard" },
      { label: "Modération", href: "/admin" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="font-bold">AfriContext</span>
          </div>
          <p className="text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Équipe {siteConfig.team} — {siteConfig.event}</p>
          <p>Les contextes indiquent toujours leur source officielle et leur date de vérification.</p>
        </div>
      </div>
    </footer>
  )
}
