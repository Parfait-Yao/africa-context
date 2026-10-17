"use client"

import { useEffect } from "react"

/** Compte une consultation (F16). Le serveur dédoublonne par visiteur et par jour. */
export function TrackView({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/contexts/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "view" }),
      keepalive: true,
    }).catch(() => {})
  }, [slug])
  return null
}
