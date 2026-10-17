"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"

/**
 * Votes (F5). L'état affiché vient du serveur ; la règle « un vote par utilisateur
 * et par contexte » est garantie en base par la contrainte unique (userId, contextId).
 */
export function VoteButtons({ slug, up, down, signedIn }: { slug: string; up: number; down: number; signedIn: boolean }) {
  const router = useRouter()
  const [counts, setCounts] = React.useState({ up, down })
  const [mine, setMine] = React.useState<1 | -1 | 0>(0)
  const [pending, setPending] = React.useState(false)
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/contexts/${slug}`)}`

  React.useEffect(() => {
    if (!signedIn) return
    fetch(`/api/contexts/${slug}/votes`)
      .then((r) => r.json())
      .then((j) => setMine(j.data?.mine ?? 0))
      .catch(() => {})
  }, [slug, signedIn])

  async function vote(value: 1 | -1) {
    // Visiteur : direction la connexion, retour sur la fiche ensuite
    if (!signedIn) return router.push(loginUrl)
    const next = mine === value ? 0 : value
    setPending(true)
    const res = await fetch(`/api/contexts/${slug}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next }),
    }).catch(() => null)
    setPending(false)
    if (res?.status === 401) {
      toast.error("Connectez-vous pour voter.", { action: { label: "Se connecter", onClick: () => router.push(loginUrl) } })
      return
    }
    const json = await res?.json().catch(() => null)
    if (!res?.ok) return toast.error(json?.error?.message ?? "Le vote n'a pas été enregistré.")
    setCounts({ up: json.data.up, down: json.data.down })
    setMine(json.data.mine)
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Voter pour ce contexte">
      <Button variant="outline" size="sm" aria-pressed={mine === 1} disabled={pending} onClick={() => vote(1)} className={cn(mine === 1 && "border-success/40 bg-success-soft text-success hover:bg-success-soft")}>
        <ThumbsUpIcon /> {formatNumber(counts.up)}
        <span className="sr-only">votes positifs</span>
      </Button>
      <Button variant="outline" size="sm" aria-pressed={mine === -1} disabled={pending} onClick={() => vote(-1)} className={cn(mine === -1 && "border-destructive/40 bg-danger-soft text-destructive hover:bg-danger-soft")}>
        <ThumbsDownIcon /> {formatNumber(counts.down)}
        <span className="sr-only">votes négatifs</span>
      </Button>
      {!signedIn && <Link href={loginUrl} className="sr-only">Se connecter pour voter</Link>}
    </div>
  )
}
