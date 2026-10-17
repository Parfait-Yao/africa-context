"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Courte vidéo en boucle d'un développeur qui code (Pexels, licence libre).
 * Muette et sans contrôles ; reste sur l'image fixe si l'utilisateur réduit les animations.
 */
export function DeveloperVideo({ className }: { className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause()
      return
    }
    // Certains navigateurs bloquent l'autoplay : l'image d'aperçu reste affichée
    video.play().catch(() => {})
  }, [])

  return (
    <video
      ref={ref}
      className={cn("block aspect-video w-full object-cover", className)}
      src="/videos/auth-developer.mp4"
      poster="/videos/auth-developer-poster.jpg"
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-label="Jeune développeur qui code sur son ordinateur portable"
    />
  )
}
