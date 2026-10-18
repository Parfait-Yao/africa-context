import Link from "next/link"
import { SearchIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

/**
 * Barre de filtres en GET : fonctionne sans JavaScript et rend chaque vue partageable par son URL.
 * Les champs sont décrits par la page ; la page courante est réinitialisée à chaque filtrage.
 */
export type FilterField =
  | { kind: "search"; name: string; label: string; placeholder?: string }
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[]; allLabel?: string }
  | { kind: "date"; name: string; label: string }

export function FilterBar({ action, fields, values }: { action: string; fields: FilterField[]; values: Record<string, string> }) {
  const active = fields.some((f) => values[f.name])
  return (
    <form action={action} method="get" role="search" className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((f) => (
        <div key={f.name} className={f.kind === "search" ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"}>
          <Label htmlFor={`f-${f.name}`} className="text-xs text-muted-foreground">{f.label}</Label>
          {f.kind === "search" && (
            <Input id={`f-${f.name}`} name={f.name} type="search" defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} />
          )}
          {f.kind === "date" && <Input id={`f-${f.name}`} name={f.name} type="date" defaultValue={values[f.name] ?? ""} />}
          {f.kind === "select" && (
            <NativeSelect id={`f-${f.name}`} name={f.name} defaultValue={values[f.name] ?? ""} wrapperClassName="w-full">
              <NativeSelectOption value="">{f.allLabel ?? "Tous"}</NativeSelectOption>
              {f.options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
      ))}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
        {active && (
          <Button asChild variant="ghost">
            <Link href={action}><XIcon /> Réinitialiser</Link>
          </Button>
        )}
        <Button type="submit"><SearchIcon /> Filtrer</Button>
      </div>
    </form>
  )
}
