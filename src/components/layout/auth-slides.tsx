"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const SLIDES = [
  {
    title: "Chaque contexte publié évite à des dizaines de développeurs de redécouvrir les mêmes pièges.",
    text: "Connectez-vous pour publier, voter et signaler.",
  },
  {
    title: "Wave, Orange Money, MTN MoMo : votre IA code avec les vrais endpoints.",
    text: "Des contextes vérifiés sur les documentations officielles.",
  },
  {
    title: "Une commande, et Cursor ou Claude Code connaît le service.",
    text: "npx africontext add wave-checkout-api",
  },
  {
    title: "Testé contre la sandbox avant d'arriver dans votre projet.",
    text: "Preuve avant / après sur le même prompt, le même modèle.",
  },
]

const INTERVAL_MS = 5000

/** Messages qui défilent toutes les 5 secondes ; pause au survol, points cliquables. */
export function AuthSlides({ className }: { className?: string }) {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [paused])

  return (
    <div
      className={cn("max-w-md", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrousel"
    >
      <div className="grid overflow-hidden" aria-live="polite">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.title}
            aria-hidden={i !== index}
            className={cn(
              "col-start-1 row-start-1 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              i === index ? "translate-x-0 opacity-100" : i < index ? "-translate-x-12 opacity-0" : "translate-x-12 opacity-0"
            )}
          >
            <p className="text-xl leading-snug font-semibold text-balance text-white">{slide.title}</p>
            <p className="mt-2 text-sm text-code-fg/75">{slide.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Message ${i + 1} sur ${SLIDES.length}`}
            aria-current={i === index}
            className="relative h-1.5 overflow-hidden rounded-full bg-white/15 transition-all duration-300 hover:bg-white/30"
            style={{ width: i === index ? 32 : 12 }}
          >
            {/* Barre de progression jusqu'au prochain message */}
            {i === index && (
              <span
                key={`${index}-${paused}`}
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ animation: paused ? undefined : `slide-progress ${INTERVAL_MS}ms linear forwards`, width: paused ? "100%" : undefined }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
