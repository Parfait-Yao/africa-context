"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeftIcon, ChevronRightIcon, QuoteIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * EXEMPLES À REMPLACER : ces témoignages sont fictifs (photos Pexels, noms inventés).
 * Remplacez-les par de vrais retours d'utilisateurs, avec leur accord, avant la mise en production.
 */
const TESTIMONIALS = [
  { name: "Moussa Diop", place: "Dakar, Sénégal", role: "Développeur backend", avatar: "/images/people/avatar-1.jpg", quote: "Cursor inventait un endpoint Wave qui n'existe pas. Avec le contexte installé, le checkout a marché du premier coup, webhook compris." },
  { name: "Aïcha Traoré", place: "Abidjan, Côte d'Ivoire", role: "Lead dev fintech", avatar: "/images/people/avatar-2.jpg", quote: "Le jeton OAuth d'Orange Money nous coûtait une demi-journée à chaque nouveau projet. Aujourd'hui, c'est une commande." },
  { name: "Kofi Mensah", place: "Accra, Ghana", role: "Développeur mobile", avatar: "/images/people/avatar-3.jpg", quote: "MTN MoMo a ses pièges, comme l'environnement sandbox et la devise EUR en test. Le contexte les liste tous." },
  { name: "Mariam Koné", place: "Bamako, Mali", role: "Développeuse full-stack", avatar: "/images/people/avatar-4.jpg", quote: "J'aime voir la preuve avant/après : on sait exactement ce que le contexte change dans le code généré." },
  { name: "Yao Kouassi", place: "Lomé, Togo", role: "Freelance", avatar: "/images/people/avatar-5.jpg", quote: "J'ai publié mon premier contexte FedaPay en dix minutes. Le formulaire a même bloqué une clé API que j'avais oubliée." },
  { name: "Nadège Mbarga", place: "Douala, Cameroun", role: "CTO", avatar: "/images/people/avatar-6.jpg", quote: "Toute l'équipe utilise les mêmes règles dans Claude Code. Les intégrations sont plus homogènes et les revues plus rapides." },
  { name: "Awa Sow", place: "Saint-Louis, Sénégal", role: "Étudiante en informatique", avatar: "/images/people/avatar-7.jpg", quote: "Pour mon projet de fin d'études, j'ai intégré Africa's Talking sans lire 40 pages de doc. Et j'ai compris pourquoi ça marche." },
]

const AUTO_MS = 6000

export function TestimonialsSection() {
  const [active, setActive] = React.useState(3)
  const [paused, setPaused] = React.useState(false)
  const count = TESTIMONIALS.length
  const go = React.useCallback((i: number) => setActive((i + count) % count), [count])

  React.useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setActive((i) => (i + 1) % count), AUTO_MS)
    return () => clearInterval(timer)
  }, [paused, count])

  const current = TESTIMONIALS[active]

  return (
    <section aria-labelledby="testimonials-title" className="relative overflow-hidden py-20 lg:py-24">
      <div className="container-page">
        <div className="reveal mx-auto max-w-2xl text-center">
          <h2 id="testimonials-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ce que disent les développeurs
          </h2>
          <p className="mt-3 text-muted-foreground">De Dakar à Douala, ils intègrent les services africains avec leur assistant IA.</p>
        </div>

        <div className="reveal" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {/* Avatars posés sur un arc ; l'actif grossit et passe au premier plan */}
          <div className="relative mx-auto mt-10 h-36 max-w-4xl">
            <svg aria-hidden viewBox="0 0 800 120" preserveAspectRatio="none" className="absolute inset-x-0 top-6 h-24 w-full text-border">
              <path d="M0 10 Q400 120 800 10" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <ul className="absolute inset-0">
              {TESTIMONIALS.map((t, i) => {
                const pos = i / (count - 1)
                const isActive = i === active
                // Même courbe que le tracé SVG : y = 4·h·x·(1−x)
                const y = 4 * 46 * pos * (1 - pos)
                return (
                  <li key={t.name} className="absolute -translate-x-1/2" style={{ left: `${4 + pos * 92}%`, top: y }}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-label={`Témoignage de ${t.name}`}
                      aria-pressed={isActive}
                      className={cn(
                        "block overflow-hidden rounded-full border-4 border-background shadow-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isActive ? "size-20 ring-4 ring-primary sm:size-24" : "size-12 opacity-80 grayscale-[35%] sm:size-16"
                      )}
                    >
                      <Image src={t.avatar} alt="" width={96} height={96} className="size-full object-cover" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="relative mx-auto mt-10 max-w-2xl">
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Témoignage précédent"
              className="absolute top-1/2 -left-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 sm:-left-5"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Témoignage suivant"
              className="absolute top-1/2 -right-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 sm:-right-5"
            >
              <ChevronRightIcon className="size-5" />
            </button>

            <figure aria-live="polite" className="rounded-3xl border bg-card px-8 py-8 text-center shadow-xl shadow-primary/5 sm:px-14">
              <div key={active} className="animate-in duration-500 fade-in slide-in-from-bottom-2">
                <QuoteIcon aria-hidden className="mx-auto size-7 text-primary/30" />
                <figcaption className="mt-3">
                  <p className="text-xl font-bold text-primary">{current.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {current.role} · {current.place}
                  </p>
                </figcaption>
                <blockquote className="mt-5 text-pretty text-muted-foreground">« {current.quote} »</blockquote>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}
