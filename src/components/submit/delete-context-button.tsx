"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/** Suppression définitive d'un contexte par son auteur, après confirmation. */
export function DeleteContextButton({
  slug,
  title,
  redirectTo,
  size = "sm",
  variant = "ghost",
  label = "Supprimer",
}: {
  slug: string
  title: string
  redirectTo?: string
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function remove() {
    setPending(true)
    const res = await fetch(`/api/contexts/${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => null)
    setPending(false)
    if (!res?.ok) {
      const json = await res?.json().catch(() => null)
      toast.error(json?.error?.message ?? "La suppression a échoué.")
      return
    }
    setOpen(false)
    toast.success("Contexte supprimé")
    if (redirectTo) router.push(redirectTo)
    router.refresh()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={variant} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2Icon /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {title} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le contexte, ses versions, ses votes et ses statistiques seront supprimés définitivement. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          {/* Bouton simple (pas AlertDialogAction) : la modale reste ouverte tant que le serveur n'a pas confirmé */}
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
