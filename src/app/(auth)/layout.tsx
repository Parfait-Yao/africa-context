import { BadgeCheckIcon, CodeXmlIcon, FlaskConicalIcon, GlobeIcon, ShieldCheckIcon, TerminalIcon, WebhookIcon, ZapIcon } from "lucide-react"
import { Logo } from "@/components/layout/logo"
import { DeveloperVideo } from "@/components/layout/developer-video"
import { AuthSlides } from "@/components/layout/auth-slides"

const highlights = [
  { Icon: BadgeCheckIcon, text: "Sources officielles datées" },
  { Icon: GlobeIcon, text: "12 pays couverts" },
  { Icon: WebhookIcon, text: "Webhooks signés expliqués" },
  { Icon: TerminalIcon, text: "Cursor · Claude Code · AGENTS.md" },
  { Icon: FlaskConicalIcon, text: "Sandbox Wave & Orange Money" },
  { Icon: ShieldCheckIcon, text: "Clés d'API jamais en clair" },
  { Icon: CodeXmlIcon, text: "XOF, XAF, GHS, NGN" },
  { Icon: ZapIcon, text: "Installé en une commande" },
]

/** Pages de connexion : tout tient dans l'écran, sans défilement. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scroll grid h-svh grid-cols-1 overflow-hidden lg:grid-cols-2">
      <div className="flex min-h-0 flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col justify-center py-6">{children}</main>
      </div>

      <aside className="relative isolate hidden min-h-0 flex-col gap-5 overflow-hidden bg-code-bg px-12 py-8 text-code-fg lg:flex">
        <div aria-hidden className="bg-brand-gradient absolute -top-32 -right-32 -z-10 size-96 rounded-full opacity-25 blur-3xl" />

        <div className="rise-in shrink-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-code-fg/85">
            <span className="size-1.5 animate-pulse rounded-full bg-[#86efac]" />
            Communauté de développeurs africains
          </span>
          <h2 className="mt-3 text-[1.75rem] leading-tight font-bold tracking-tight text-balance text-white">
            Codez les paiements africains <span className="text-brand-gradient">sans deviner.</span>
          </h2>
        </div>

        {/* La vidéo prend la hauteur restante : rien ne dépasse de l'écran */}
        <figure
          className="rise-in min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          style={{ "--d": "150ms" } as React.CSSProperties}
        >
          <DeveloperVideo className="aspect-auto h-full" />
        </figure>

        <AuthSlides className="rise-in shrink-0" />

        {/* Bandeau de cartes presque transparentes qui défile horizontalement */}
        <div className="rise-in group mask-fade-x -mx-12 shrink-0 overflow-hidden" style={{ "--d": "300ms" } as React.CSSProperties}>
          <div className="animate-marquee flex w-max gap-3 group-hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex gap-3">
                {highlights.map(({ Icon, text }) => (
                  <li
                    key={text}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm whitespace-nowrap text-code-fg/70 transition-colors hover:border-white/15 hover:text-white"
                  >
                    <Icon className="size-4 text-[#7dd3fc]/80" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
