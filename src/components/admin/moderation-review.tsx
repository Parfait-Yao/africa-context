"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2Icon, CheckIcon, CircleIcon, ExternalLinkIcon, EyeIcon, RefreshCwIcon, ShieldAlertIcon, ShieldCheckIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { StatusBadge } from "@/components/contexts/status-badge"
import type { ContextStatus } from "@/modules/contexts/context.types"
import { cn } from "@/lib/utils"

export interface ReviewData {
  slug: string
  title: string
  status: ContextStatus
  sourceUrl: string
  author: string
  content: string
  sections: { title: string; ok: boolean }[]
  secrets: { label: string; excerpt: string; line: number }[]
}

/** Panneau de relecture + décision (PATCH /api/admin/contexts/:slug). Le motif est obligatoire pour rejeter. */
export function ModerationReview({ data }: { data: ReviewData }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<string | null>(null)

  async function decide(status: "approved" | "rejected" | "to_recheck") {
    if (status === "rejected" && !reason.trim()) {
      toast.error("Indiquez le motif du rejet : il sera montré au contributeur.")
      return
    }
    setPending(status)
    const res = await fetch(`/api/admin/contexts/${data.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason: reason.trim() || undefined }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setPending(null)
    if (!res?.ok) return toast.error(json?.error?.message ?? "Action refusée par le serveur.")
    toast.success(status === "approved" ? "Contexte approuvé et publié" : status === "rejected" ? "Contexte rejeté" : "Revérification demandée")
    setOpen(false)
    router.refresh()
  }

  const canApprove = data.status === "pending" || data.status === "to_recheck"
  const specOk = data.sections.every((s) => s.ok)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline"><EyeIcon /> Relire</Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2"><StatusBadge status={data.status} /></div>
          <SheetTitle className="text-xl">{data.title}</SheetTitle>
          <SheetDescription>
            Par {data.author} ·{" "}
            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              documentation officielle <ExternalLinkIcon className="size-3" />
            </a>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className={cn("mb-2 text-sm font-semibold", specOk ? "text-success" : "text-warning")}>
                Spec : {data.sections.filter((s) => s.ok).length}/{data.sections.length} sections
              </p>
              <ul className="space-y-1 text-xs">
                {data.sections.map((s) => (
                  <li key={s.title} className={cn("flex items-center gap-1.5", !s.ok && "text-muted-foreground")}>
                    {s.ok ? <CheckCircle2Icon className="size-3.5 text-success" /> : <CircleIcon className="size-3.5" />} {s.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn("rounded-lg border p-3", data.secrets.length && "border-destructive/40 bg-danger-soft")}>
              {data.secrets.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><ShieldCheckIcon className="size-4" /> Aucun secret détecté</p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive"><ShieldAlertIcon className="size-4" /> {data.secrets.length} secret(s)</p>
                  <ul className="mt-1 space-y-1 text-xs text-destructive">
                    {data.secrets.map((s, i) => <li key={i}>Ligne {s.line} : {s.label} <code>{s.excerpt}</code></li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
          <pre className="max-h-[45vh] overflow-auto rounded-lg bg-code-bg p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-code-fg">{data.content}</pre>
          <div className="grid gap-2">
            <Label htmlFor={`reason-${data.slug}`}>Motif (obligatoire pour rejeter, visible par le contributeur)</Label>
            <Textarea id={`reason-${data.slug}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. l'endpoint /v1/checkout/sessions attend amount en chaîne : corriger l'exemple." />
          </div>
        </div>

        <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t">
          {canApprove && (!specOk || data.secrets.length > 0) && (
            <p className="mr-auto text-xs text-muted-foreground">Publication bloquée tant que la Spec n'est pas complète et sans secret.</p>
          )}
          {data.status === "approved" && (
            <Button variant="outline" onClick={() => decide("to_recheck")} disabled={!!pending}><RefreshCwIcon /> À revérifier</Button>
          )}
          {canApprove && (
            <>
              <Button variant="outline" onClick={() => decide("rejected")} disabled={!!pending}><XIcon /> Rejeter</Button>
              <Button onClick={() => decide("approved")} disabled={!!pending || data.secrets.length > 0 || !specOk}><CheckIcon /> {pending === "approved" ? "Publication…" : "Approuver et publier"}</Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
