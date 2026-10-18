"use client"

import * as React from "react"
import { SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

export interface SettingFieldProps {
  settingKey: string
  label: string
  type: "number" | "boolean"
  value: number | boolean
  defaultValue: number | boolean
  unit: string | null
}

/** Modification d'un paramètre : confirmation, validation et journalisation côté serveur. */
export function SettingField({ settingKey, label, type, value, defaultValue, unit }: SettingFieldProps) {
  const { run, pending } = useAdminAction()
  const [draft, setDraft] = React.useState(String(value))
  const id = React.useId()
  const save = (next: number | boolean) => run("/api/admin/settings", { method: "PATCH", body: { key: settingKey, value: next } }, "Paramètre enregistré")

  if (type === "boolean") {
    const on = value === true
    return (
      <ConfirmAction
        trigger={
          <Button type="button" variant="outline" size="sm" disabled={pending} aria-label={`${on ? "Désactiver" : "Activer"} : ${label}`}>
            <span className={on ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-muted-foreground/50"} aria-hidden="true" />
            {on ? "Activé — désactiver" : "Désactivé — activer"}
          </Button>
        }
        title={`${on ? "Désactiver" : "Activer"} : ${label} ?`}
        description="La modification prend effet immédiatement et est enregistrée dans le journal d'audit."
        confirmLabel={on ? "Désactiver" : "Activer"}
        onConfirm={() => save(!on)}
        pending={pending}
      />
    )
  }

  const parsed = Number(draft)
  const changed = draft.trim() !== "" && Number.isFinite(parsed) && parsed !== value
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-28"
        aria-label={label}
      />
      {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      <ConfirmAction
        trigger={<Button type="button" size="sm" disabled={pending || !changed}><SaveIcon /> Enregistrer</Button>}
        title={`Modifier : ${label} ?`}
        description={`Nouvelle valeur : ${draft}${unit ? ` ${unit}` : ""} (actuelle : ${value}, par défaut : ${defaultValue}). La valeur est validée par le serveur et la modification est journalisée.`}
        confirmLabel="Enregistrer"
        onConfirm={() => save(parsed)}
        pending={pending}
      />
      {value !== defaultValue && (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setDraft(String(defaultValue))}>
          Valeur par défaut ({String(defaultValue)})
        </Button>
      )}
    </form>
  )
}
