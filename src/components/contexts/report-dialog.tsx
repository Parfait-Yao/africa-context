"use client"

import * as React from "react"
import Link from "next/link"
import { FlagIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

const REASONS = [
  { value: "obsolete", label: "Obsolète : l'API a changé" },
  { value: "incorrect", label: "Incorrect : endpoint ou champ erroné" },
  { value: "dangerous", label: "Dangereux : pousse à écrire du code risqué" },
  { value: "secret", label: "Contient un secret" },
  { value: "other", label: "Autre" },
]

export function ReportDialog({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("obsolete")
  const [details, setDetails] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    const res = await fetch(`/api/contexts/${slug}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details || undefined }),
    }).catch(() => null)
    setPending(false)
    if (res?.status === 401) {
      toast.error("Connectez-vous pour signaler un contexte.")
      return
    }
    const json = await res?.json().catch(() => null)
    if (res?.ok) {
      toast.success("Signalement envoyé à la modération")
      setOpen(false)
      setDetails("")
    } else toast.error(json?.error?.message ?? "Le signalement n'a pas été envoyé. Réessayez.")
  }

  // Visiteur : connexion d'abord, sans lui faire remplir le formulaire pour rien
  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/contexts/${slug}`)}`} aria-label="Se connecter pour signaler ce contexte">
          <FlagIcon /> Signaler
        </Link>
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <FlagIcon /> Signaler
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Signaler ce contexte</DialogTitle>
            <DialogDescription>Un administrateur le revérifie. S'il est confirmé, le contexte passe en « À revérifier ».</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="gap-3">
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-3">
                <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                <Label htmlFor={`reason-${r.value}`} className="font-normal">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="grid gap-2">
            <Label htmlFor="report-details">Détails (facultatif)</Label>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ex. le champ amount doit être une chaîne depuis la v1.2" maxLength={1000} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Envoyer le signalement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
