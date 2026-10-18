"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

/** Dialogue à un champ (création ou renommage). */
function NameDialog({
  trigger, title, description, label, initial = "", submitLabel, maxLength, onSubmit, pending,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  label: string
  initial?: string
  submitLabel: string
  maxLength: number
  onSubmit: (value: string) => Promise<boolean>
  pending: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(initial)
  const id = React.useId()
  const tooShort = value.trim().length < 2
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(initial) }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!tooShort && (await onSubmit(value.trim()))) setOpen(false)
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={value} maxLength={maxLength} onChange={(e) => setValue(e.target.value)} aria-invalid={value !== "" && tooShort} autoFocus />
            <p className="text-xs text-muted-foreground">2 à {maxLength} caractères.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || tooShort || value.trim() === initial}>{pending ? "Enregistrement…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateTagButton() {
  const { run, pending } = useAdminAction()
  return (
    <NameDialog
      trigger={<Button><PlusIcon /> Nouveau tag</Button>}
      title="Nouveau tag"
      description="Les tags sont enregistrés en minuscules. Les contributeurs pourront aussi le choisir à la soumission."
      label="Nom du tag"
      submitLabel="Créer"
      maxLength={30}
      onSubmit={(name) => run("/api/admin/tags", { method: "POST", body: { name } }, `Tag « ${name.toLowerCase()} » créé`)}
      pending={pending}
    />
  )
}

export function TagRowActions({ id, name, uses }: { id: string; name: string; uses: number }) {
  const { run, pending } = useAdminAction()
  return (
    <div className="flex justify-end gap-1">
      <NameDialog
        trigger={<Button size="sm" variant="ghost" aria-label={`Renommer ${name}`}><PencilIcon /> Renommer</Button>}
        title={`Renommer « ${name} »`}
        description={uses ? `Le nouveau nom s'appliquera aux ${uses} contexte(s) qui l'utilisent.` : "Ce tag n'est utilisé par aucun contexte."}
        label="Nouveau nom"
        initial={name}
        submitLabel="Renommer"
        maxLength={30}
        onSubmit={(next) => run(`/api/admin/tags/${encodeURIComponent(id)}`, { method: "PATCH", body: { name: next } }, "Tag renommé")}
        pending={pending}
      />
      {uses === 0 && (
        <ConfirmAction
          trigger={<Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Supprimer ${name}`}><Trash2Icon /> Supprimer</Button>}
          title={`Supprimer le tag « ${name} » ?`}
          description="Ce tag n'est utilisé par aucun contexte. La suppression est définitive."
          confirmLabel="Supprimer"
          destructive
          onConfirm={() => run(`/api/admin/tags/${encodeURIComponent(id)}`, { method: "DELETE" }, "Tag supprimé")}
          pending={pending}
        />
      )}
    </div>
  )
}

export function RenameServiceButton({ name, uses, existing }: { name: string; uses: number; existing: string[] }) {
  const { run, pending } = useAdminAction()
  return (
    <NameDialog
      trigger={<Button size="sm" variant="ghost" aria-label={`Renommer ${name}`}><PencilIcon /> Renommer / fusionner</Button>}
      title={`Renommer « ${name} »`}
      description={`Le nom sera remplacé sur ${uses} contexte(s). Si vous saisissez un service existant (${existing.slice(0, 3).join(", ")}…), les deux seront fusionnés. Le logo dépend du nom exact défini dans le code.`}
      label="Nouveau nom du service"
      initial={name}
      submitLabel="Renommer"
      maxLength={60}
      onSubmit={(to) => run("/api/admin/services", { method: "PATCH", body: { from: name, to } }, `Service renommé en « ${to} »`)}
      pending={pending}
    />
  )
}
