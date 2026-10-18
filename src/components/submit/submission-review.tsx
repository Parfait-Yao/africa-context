import { ArrowLeftIcon, CheckCircle2Icon, ExternalLinkIcon, PencilIcon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/contexts/markdown"
import { ServiceLogo } from "@/components/contexts/service-logo"
import { CONTEXT_TYPE_LABELS, TOOL_LABELS, categoryLabel, countryName } from "@/config/site"
import type { SubmitFormValues } from "./submit-form"

type FieldKey = keyof SubmitFormValues

/**
 * Récapitulatif avant envoi : tout ce que l'auteur a saisi, contenu rendu comme sur la fiche publique.
 * Chaque bloc renvoie vers le champ correspondant du formulaire.
 */
export function SubmissionReview({
  values,
  tags,
  isEdit,
  submitting,
  onEdit,
  onConfirm,
}: {
  values: SubmitFormValues
  tags: string[]
  isEdit: boolean
  submitting: boolean
  onEdit: (field?: FieldKey) => void
  onConfirm: () => void
}) {
  const rows: { label: string; field: FieldKey; value: React.ReactNode }[] = [
    { label: "Titre", field: "title", value: values.title },
    { label: "Slug", field: "slug", value: <code className="font-mono text-sm">{values.slug}</code> },
    {
      label: "Service",
      field: "service",
      value: (
        <span className="inline-flex items-center gap-2">
          <ServiceLogo name={values.service} size="sm" /> {values.service}
        </span>
      ),
    },
    { label: "Description", field: "description", value: values.description },
    { label: "Format", field: "type", value: <span className="font-mono text-sm">{CONTEXT_TYPE_LABELS[values.type]}</span> },
    { label: "Catégorie", field: "category", value: categoryLabel(values.category) },
    {
      label: "Documentation officielle",
      field: "source_url",
      value: (
        <a href={values.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
          {values.source_url} <ExternalLinkIcon className="size-3.5 shrink-0" />
        </a>
      ),
    },
    { label: "Version d'API", field: "version_api", value: <span className="font-mono text-sm">{values.version_api}</span> },
    { label: "Pays couverts", field: "pays", value: <Chips items={values.pays.map(countryName)} /> },
    { label: "Testé avec", field: "tested_with", value: values.tested_with.length ? <Chips items={values.tested_with.map((t) => TOOL_LABELS[t])} /> : <Empty /> },
    { label: "Tags", field: "tagsInput", value: tags.length ? <Chips items={tags} mono /> : <Empty /> },
  ]

  return (
    <div className="animate-in duration-300 fade-in slide-in-from-bottom-2">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-primary/30 bg-accent/60 p-5">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2Icon className="size-5 text-success" /> Relisez avant {isEdit ? "de resoumettre" : "de publier"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Voici exactement ce qui sera envoyé. Cliquez sur « Modifier » à côté d'une information pour la corriger.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => onEdit()}>
          <ArrowLeftIcon /> Retour au formulaire
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="review-fields" className="overflow-hidden rounded-xl border bg-card">
            <h2 id="review-fields" className="border-b bg-muted/40 px-5 py-3 text-sm font-semibold">
              Informations
            </h2>
            <dl className="divide-y">
              {rows.map((r) => (
                <div key={r.field} className="group grid gap-1 px-5 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <dt className="text-sm text-muted-foreground">{r.label}</dt>
                  <dd className="min-w-0 text-sm break-words">{r.value}</dd>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(r.field)}
                    className="justify-self-start opacity-70 group-hover:opacity-100 sm:justify-self-end"
                  >
                    <PencilIcon /> Modifier
                  </Button>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="review-content" className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-2">
              <h2 id="review-content" className="text-sm font-semibold">
                Contenu, tel qu'il sera affiché
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => onEdit("content")}>
                <PencilIcon /> Modifier
              </Button>
            </div>
            <div className="max-h-[36rem] overflow-y-auto p-5 sm:p-8">
              <Markdown>{values.content}</Markdown>
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Button type="button" size="lg" className="w-full" disabled={submitting} onClick={onConfirm}>
            <SendIcon /> {submitting ? "Envoi…" : isEdit ? "Confirmer et resoumettre" : "Confirmer et publier"}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" disabled={submitting} onClick={() => onEdit()}>
            <PencilIcon /> Modifier
          </Button>
          <p className="text-xs text-muted-foreground">
            Après l'envoi, le contexte attend la relecture d'un administrateur. Vous pourrez encore le modifier ou le supprimer depuis « Mes
            contributions ».
          </p>
        </aside>
      </div>
    </div>
  )
}

function Chips({ items, mono = false }: { items: string[]; mono?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i} className={`rounded-md border bg-background px-2 py-0.5 text-xs ${mono ? "font-mono" : ""}`}>
          {i}
        </li>
      ))}
    </ul>
  )
}

function Empty() {
  return <span className="text-muted-foreground">—</span>
}
