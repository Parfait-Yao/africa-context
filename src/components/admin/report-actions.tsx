"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function ReportActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  async function act(action: "recheck" | "dismiss") {
    setPending(true)
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null)
    setPending(false)
    if (!res?.ok) return toast.error("Action refusée par le serveur.")
    toast.success(action === "recheck" ? "Contexte marqué à revérifier" : "Signalement classé")
    router.refresh()
  }
  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act("dismiss")}>Classer</Button>
      <Button size="sm" disabled={pending} onClick={() => act("recheck")}>Marquer à revérifier</Button>
    </div>
  )
}
