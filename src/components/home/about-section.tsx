import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { CountUp } from "@/components/contexts/count-up"
import developerPhoto from "../../../public/images/people/about-developer.png"
import { cn } from "@/lib/utils"

/** Étiquettes posées en éventail sur le bas du cercle, comme des autocollants. */
const TAGS = [
  { label: "Wave", className: "left-[34%] top-[54%] -rotate-3", tone: "light" },
  { label: "Orange Money", className: "left-[4%] top-[63%] -rotate-6", tone: "dark" },
  { label: "Webhooks", className: "left-[55%] top-[64%] rotate-3", tone: "light" },
  { label: "MTN MoMo", className: "left-[0%] top-[75%] rotate-6", tone: "light" },
  { label: "Sandbox", className: "left-[34%] top-[75%] -rotate-2", tone: "dark" },
  { label: "Cursor", className: "left-[66%] top-[76%] -rotate-12", tone: "dark" },
  { label: "Claude Code", className: "left-[24%] top-[86%] rotate-2", tone: "light" },
] as const

export function AboutSection({ stats }: { stats: { services: number; countries: number; contexts: number } }) {
  return (
    <section aria-labelledby="about-title" className="relative isolate overflow-hidden bg-code-bg text-code-fg">
      <div aria-hidden className="animate-drift absolute -top-24 -left-24 -z-10 size-96 rounded-full bg-brand-cyan/15 blur-3xl" />

      <div className="container-page grid grid-cols-1 items-center gap-14 py-20 lg:grid-cols-[0.9fr_1fr] lg:py-24">
        {/* Visuel : développeur détouré qui sort du cercle et pointe vers le texte */}
        <div className="reveal relative mx-auto aspect-square w-full max-w-[26rem]">
          <div className="bg-brand-gradient absolute inset-[6%] rounded-full shadow-[0_0_80px_-10px] shadow-brand-cyan/50" />
          <div aria-hidden className="absolute inset-[12%] rounded-full border-2 border-dashed border-white/25" />
          {/* Le haut dépasse du cercle ; le bas est coupé par le cercle */}
          <div className="absolute inset-x-[6%] -top-[4%] bottom-[6%] overflow-hidden rounded-b-full">
            <Image
              src={developerPhoto}
              alt="Jeune développeur souriant qui pointe vers la présentation d'AfriContext"
              placeholder="blur"
              sizes="(min-width: 1024px) 26rem, 80vw"
              className="absolute bottom-0 left-1/2 h-[104%] w-auto max-w-none -translate-x-[48%] object-contain"
            />
          </div>
          <ul aria-label="Ce que couvrent les contextes">
            {TAGS.map((tag, i) => (
              <li
                key={tag.label}
                className={cn(
                  "animate-float absolute rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shadow-lg transition-transform hover:scale-110 sm:text-sm",
                  tag.tone === "light" ? "bg-white text-[#0f1834]" : "border border-white/15 bg-[#0f1834] text-white",
                  tag.className
                )}
                style={{ animationDelay: `${-i * 0.8}s`, animationDuration: `${5 + (i % 3)}s` }}
              >
                {tag.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal">
          <p className="flex items-center gap-2 text-sm font-medium text-[#7dd3fc]">
            <span aria-hidden className="h-px w-6 bg-[#7dd3fc]" /> À propos
          </p>
          <h2 id="about-title" className="mt-3 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
            Qui est <span className="text-brand-gradient">AfriContext ?</span>
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-code-fg/75">
            Une communauté de développeurs africains qui documente, pour les assistants IA, les services qu'on utilise tous les jours :
            paiement mobile, agrégateurs, SMS. Chaque contexte part de la documentation officielle, puis il est testé contre une sandbox
            avant d'être publié.
          </p>

          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-6">
            {[
              { value: stats.services, label: "services couverts" },
              { value: stats.countries, label: "pays" },
              { value: stats.contexts, label: "contextes vérifiés" },
            ].map((s) => (
              <div key={s.label}>
                <dd className="text-3xl font-bold tracking-tight text-white">
                  <CountUp value={s.value} />
                  <span className="text-brand-gradient">+</span>
                </dd>
                <dt className="mt-1 text-sm text-code-fg/60">{s.label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link
              href="/contexts"
              className="group inline-flex items-center gap-3 rounded-full border border-white/20 py-1.5 pr-1.5 pl-5 text-sm font-medium text-white transition-all hover:border-white/40 hover:bg-white/5 active:scale-[0.97]"
            >
              Explorer le catalogue
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-white text-[#0f1834] transition-transform group-hover:translate-x-0.5 group-hover:-rotate-45">
                <ArrowRightIcon className="size-4" />
              </span>
            </Link>
            <p className="text-brand-gradient text-lg font-semibold italic">— L&apos;équipe Impaact code</p>
          </div>
        </div>
      </div>
    </section>
  )
}
