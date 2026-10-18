"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface ConfirmActionProps {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  /** "required" : motif obligatoire (rejet, dépublication), visible par le contributeur. */
  reason?: "required" | "optional"
  /** Libellé du champ motif, quand il n'est pas destiné au contributeur (note interne…). */
  reasonLabel?: string
  /** Saisie du slug exigée avant de confirmer (suppression). */
  confirmText?: string
  onConfirm: (reason: string) => Promise<boolean>
  pending: boolean
}

/** Dialogue de confirmation commun : la modale reste ouverte tant que le serveur n'a pas accepté. */
export function ConfirmAction({ trigger, title, description, confirmLabel, destructive, reason, reasonLabel, confirmText, onConfirm, pending }: ConfirmActionProps) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [typed, setTyped] = React.useState("")
  const id = React.useId()
  const blocked = (reason === "required" && !text.trim()) || (confirmText !== undefined && typed !== confirmText)

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setText(""); setTyped("") } }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-reason`}>
              {reasonLabel ?? "Motif"} {reason === "required" ? (reasonLabel ? "(obligatoire)" : "(obligatoire, visible par le contributeur)") : "(facultatif)"}
            </Label>
            <Textarea id={`${id}-reason`} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
        {confirmText !== undefined && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-confirm`}>
              Tapez <code className="font-mono">{confirmText}</code> pour confirmer
            </Label>
            <Input id={`${id}-confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="font-mono" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || blocked}
            onClick={async () => {
              if (await onConfirm(text.trim())) setOpen(false)
            }}
          >
            {pending ? "Envoi…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
