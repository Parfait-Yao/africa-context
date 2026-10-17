"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2Icon, CircleIcon, ClockIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { CATEGORIES, CONTEXT_TYPE_LABELS, COUNTRIES, TOOL_LABELS } from "@/config/site"
import { AI_TOOLS, CONTEXT_TYPES } from "@/modules/contexts/context.types"
import { REQUIRED_SECTIONS, SPEC_BODY_TEMPLATE, checkSections, specFrontmatterSchema } from "@/modules/spec/spec.schema"
import { scanForSecrets } from "@/modules/spec/secret-scanner"
import { slugify } from "@/components/contexts/markdown"
import { cn } from "@/lib/utils"

/** Schéma du formulaire : identique à la Spec, sauf les tags saisis en texte. */
const formSchema = specFrontmatterSchema.omit({ tags: true, tested_with: true }).extend({
  tested_with: z.array(z.enum(AI_TOOLS)),
  tagsInput: z.string(),
  content: z.string().min(200, "Le contenu doit faire au moins 200 caractères."),
})
type FormValues = z.infer<typeof formSchema>

const TYPE_HELP: Record<(typeof CONTEXT_TYPES)[number], string> = {
  cursorrules: "Règles pour Cursor, aussi exportables vers CLAUDE.md et AGENTS.md.",
  claude_prompt: "Instructions destinées à Claude Code ou à un agent.",
  mcp_server: "URL d'un serveur MCP. Elle est affichée, jamais exécutée par la plateforme.",
}

export type SubmitFormValues = FormValues

/**
 * Formulaire de soumission. Avec `editSlug`, il corrige un contexte existant
 * (PUT, nouvelle version, retour en attente de validation).
 */
export function SubmitForm({ initial, editSlug, rejectionReason, aiEnabled = false }: { initial?: Partial<FormValues>; editSlug?: string; rejectionReason?: string; aiEnabled?: boolean }) {
  const [draftUrl, setDraftUrl] = React.useState("")
  const [drafting, setDrafting] = React.useState(false)
  const [slugTouched, setSlugTouched] = React.useState(Boolean(editSlug))
  const fileRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [submitted, setSubmitted] = React.useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      type: "cursorrules",
      service: "",
      category: "",
      pays: [],
      version_api: "v1",
      source_url: "",
      tested_with: [],
      tagsInput: "",
      content: SPEC_BODY_TEMPLATE,
      ...initial,
    },
  })
  const { register, control, handleSubmit, setValue, setError, formState } = form
  const content = useWatch({ control, name: "content" })
  const title = useWatch({ control, name: "title" })
  const all = useWatch({ control })

  React.useEffect(() => {
    if (!slugTouched) setValue("slug", slugify(title ?? ""), { shouldValidate: false })
  }, [title, slugTouched, setValue])

  const sections = React.useMemo(() => checkSections(content ?? ""), [content])
  const secrets = React.useMemo(() => scanForSecrets(Object.values(all ?? {}).flat().join("\n")), [all])

  async function onSubmit(values: FormValues) {
    if (secrets.length > 0) {
      toast.error("Retirez le secret détecté avant de publier.")
      return
    }
    const { tagsInput, ...rest } = values
    const payload = { ...rest, tags: tagsInput.split(",").map((t) => slugify(t)).filter(Boolean) }

    const res = await fetch(editSlug ? `/api/contexts/${editSlug}` : "/api/contexts", {
      method: editSlug ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null)

    if (!res) return toast.error("Le serveur ne répond pas. Vérifiez votre connexion et réessayez.")
    const json = await res.json()
    if (res.status === 401) {
      router.push("/login?callbackUrl=/submit")
      return
    }
    if (res.status === 201 || (editSlug && res.ok)) {
      setSubmitted(json.data.slug)
      toast.success("Contexte soumis : en attente de validation")
      return
    }
    const fieldErrors = (json.error?.details?.fieldErrors ?? {}) as Record<string, string[]>
    Object.entries(fieldErrors).forEach(([k, msgs]) => setError(k as keyof FormValues, { message: msgs[0] }))
    toast.error(json.error?.message ?? "La soumission a été refusée.")
  }

  if (submitted) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <ClockIcon className="size-8 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">Contexte soumis, en attente de validation</h2>
        <p className="mt-2 max-w-lg text-muted-foreground">
          Un administrateur va relire <code className="font-mono text-foreground">{submitted}</code> sur la documentation officielle.
          Il apparaîtra dans le catalogue dès qu'il sera approuvé.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild><Link href="/dashboard">Voir mes contributions</Link></Button>
          <Button variant="outline" onClick={() => { form.reset(); setSubmitted(null); setSlugTouched(false) }}>Soumettre un autre contexte</Button>
        </div>
      </div>
    )
  }

  function onInvalid() {
    if (secrets.length > 0) toast.error("Retirez le secret détecté avant de publier.")
    else toast.error("Certains champs sont à corriger : ils sont signalés en rouge.")
  }

  async function importMarkdown(file: File) {
    const res = await fetch("/api/spec/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: await file.text() }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (!res?.ok || !json?.data) return toast.error("Fichier illisible : il doit commencer par un en-tête --- au format de la Spec.")
    applyFields(json.data as Record<string, unknown>)
    toast.success(`${file.name} importé : vérifiez les champs avant de soumettre`)
  }

  async function generateDraft() {
    if (!/^https?:\/\//.test(draftUrl)) return toast.error("Collez l'URL complète de la documentation officielle.")
    setDrafting(true)
    const res = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: draftUrl }) }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setDrafting(false)
    if (!res?.ok) return toast.error(json?.error?.message ?? "Le brouillon n'a pas pu être généré.")
    applyFields(json.data.fields)
    toast.success("Brouillon généré : relisez chaque section sur la documentation avant de soumettre")
  }

  function applyFields(d: Record<string, unknown>) {
    const set = (k: keyof FormValues, v: unknown) => v !== undefined && v !== "" && setValue(k, v as never, { shouldValidate: true })
    set("title", d.title)
    if (d.slug && !editSlug) {
      set("slug", d.slug)
      setSlugTouched(true)
    }
    set("description", d.description)
    set("type", d.type)
    set("service", d.service)
    set("category", d.category)
    set("pays", d.pays)
    set("version_api", d.version_api)
    set("source_url", d.source_url)
    set("tested_with", d.tested_with)
    if (Array.isArray(d.tags)) set("tagsInput", (d.tags as string[]).join(", "))
    set("content", d.content)
  }

  const specOk = sections.missing.length === 0

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-10">
        {rejectionReason && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm text-destructive">
            <p className="font-semibold">Motif du rejet</p>
            <p className="mt-1">{rejectionReason}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">Vous avez déjà un fichier <code className="font-mono">.md</code> au format de la Spec ?</p>
          <input ref={fileRef} type="file" accept=".md,.mdc,text/markdown,text/plain" className="sr-only" aria-label="Importer un fichier Markdown"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMarkdown(f); e.target.value = "" }} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Importer un fichier .md</Button>
        </div>
        {aiEnabled && !editSlug && (
          <div className="rounded-xl border bg-card p-4">
            <Label htmlFor="draft-url" className="font-semibold">Brouillon assisté par IA</Label>
            <p className="mt-1 text-sm text-muted-foreground">Collez l'URL de la documentation officielle : un brouillon au format Spec pré-remplit le formulaire. Relisez-le avant de soumettre.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input id="draft-url" type="url" inputMode="url" placeholder="https://docs.wave.com/checkout" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} />
              <Button type="button" variant="secondary" onClick={generateDraft} disabled={drafting} className="shrink-0">{drafting ? "Génération…" : "Générer le brouillon"}</Button>
            </div>
          </div>
        )}
        <FieldSet>
          <FieldLegend>Identité du contexte</FieldLegend>
          <FieldGroup>
            <Field data-invalid={!!formState.errors.title}>
              <FieldLabel htmlFor="title">Titre</FieldLabel>
              <Input id="title" placeholder="Wave — API Checkout" aria-invalid={!!formState.errors.title} {...register("title")} />
              <FieldError errors={[formState.errors.title]} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!formState.errors.slug}>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input id="slug" className="font-mono" readOnly={Boolean(editSlug)} aria-invalid={!!formState.errors.slug} {...register("slug", { onChange: () => setSlugTouched(true) })} />
                <FieldDescription>Utilisé dans <code className="font-mono">npx africontext add {all.slug || "<slug>"}</code></FieldDescription>
                <FieldError errors={[formState.errors.slug]} />
              </Field>
              <Field data-invalid={!!formState.errors.service}>
                <FieldLabel htmlFor="service">Service</FieldLabel>
                <Input id="service" placeholder="Wave" aria-invalid={!!formState.errors.service} {...register("service")} />
                <FieldError errors={[formState.errors.service]} />
              </Field>
            </div>
            <Field data-invalid={!!formState.errors.description}>
              <FieldLabel htmlFor="description">Description courte</FieldLabel>
              <Textarea id="description" rows={2} placeholder="Ce que le contexte permet d'intégrer, en une phrase." aria-invalid={!!formState.errors.description} {...register("description")} />
              <FieldError errors={[formState.errors.description]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Format</FieldLegend>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-3">
                {CONTEXT_TYPES.map((t) => (
                  <label
                    key={t}
                    htmlFor={`type-${t}`}
                    className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent")}
                  >
                    <span className="flex items-center gap-2 font-mono text-sm font-medium">
                      <RadioGroupItem value={t} id={`type-${t}`} /> {CONTEXT_TYPE_LABELS[t]}
                    </span>
                    <span className="text-xs text-muted-foreground">{TYPE_HELP[t]}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </FieldSet>

        <FieldSet>
          <FieldLegend>Source et couverture</FieldLegend>
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-[1fr_8rem]">
              <Field data-invalid={!!formState.errors.source_url}>
                <FieldLabel htmlFor="source_url">URL de la documentation officielle</FieldLabel>
                <Input id="source_url" type="url" inputMode="url" placeholder="https://docs.wave.com/checkout" aria-invalid={!!formState.errors.source_url} {...register("source_url")} />
                <FieldError errors={[formState.errors.source_url]} />
              </Field>
              <Field data-invalid={!!formState.errors.version_api}>
                <FieldLabel htmlFor="version_api">Version d'API</FieldLabel>
                <Input id="version_api" className="font-mono" {...register("version_api")} />
                <FieldError errors={[formState.errors.version_api]} />
              </Field>
            </div>
            <Field data-invalid={!!formState.errors.category}>
              <FieldLabel htmlFor="category">Catégorie</FieldLabel>
              <NativeSelect id="category" wrapperClassName="w-full sm:w-72" className="w-full" aria-invalid={!!formState.errors.category} {...register("category")}>
                <NativeSelectOption value="">Choisir…</NativeSelectOption>
                {CATEGORIES.map((c) => <NativeSelectOption key={c.value} value={c.value}>{c.label}</NativeSelectOption>)}
              </NativeSelect>
              <FieldError errors={[formState.errors.category]} />
            </Field>
            <Controller
              control={control}
              name="pays"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldTitle>Pays couverts</FieldTitle>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COUNTRIES.map((c) => (
                      <label key={c.code} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(c.code)}
                          onCheckedChange={(v) => field.onChange(v ? [...field.value, c.code] : field.value.filter((x) => x !== c.code))}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="tested_with"
              render={({ field }) => (
                <Field>
                  <FieldTitle>Testé avec</FieldTitle>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {AI_TOOLS.map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(t)}
                          onCheckedChange={(v) => field.onChange(v ? [...field.value, t] : field.value.filter((x) => x !== t))}
                        />
                        {TOOL_LABELS[t]}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
            />
            <Field>
              <FieldLabel htmlFor="tagsInput">Tags</FieldLabel>
              <Input id="tagsInput" placeholder="fintech, paiement-mobile, webhook" {...register("tagsInput")} />
              <FieldDescription>Séparés par des virgules, 8 au maximum.</FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Contenu</FieldLegend>
          <Field data-invalid={!!formState.errors.content}>
            <FieldLabel htmlFor="content" className="sr-only">Contenu Markdown</FieldLabel>
            <FieldDescription>Markdown. Gardez les huit titres de section ; écrivez les noms des variables d'environnement, jamais leurs valeurs.</FieldDescription>
            <Textarea id="content" rows={22} spellCheck={false} className="font-mono text-[0.82rem] leading-6" aria-invalid={!!formState.errors.content} {...register("content")} />
            <FieldError errors={[formState.errors.content]} />
          </Field>
        </FieldSet>
      </div>

      {/* Panneau de contrôle en direct */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
        <div className="rounded-xl border bg-card p-5">
          <p className="flex items-center justify-between text-sm font-semibold">
            AfriContext Spec
            <span className={cn("font-mono text-xs", specOk ? "text-success" : "text-muted-foreground")}>
              {sections.present.length}/{REQUIRED_SECTIONS.length}
            </span>
          </p>
          <ul className="mt-3 space-y-2">
            {REQUIRED_SECTIONS.map((s) => {
              const ok = sections.present.includes(s.key)
              return (
                <li key={s.key} className={cn("flex items-center gap-2 text-sm", ok ? "text-foreground" : "text-muted-foreground")}>
                  {ok ? <CheckCircle2Icon className="size-4 text-success" /> : <CircleIcon className="size-4" />}
                  {s.title}
                </li>
              )
            })}
          </ul>
        </div>

        <div className={cn("rounded-xl border p-5", secrets.length ? "border-destructive/40 bg-danger-soft" : "bg-card")}>
          {secrets.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <ShieldCheckIcon className="size-4" /> Aucun secret détecté
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <ShieldAlertIcon className="size-4" /> {secrets.length} secret{secrets.length > 1 ? "s" : ""} détecté{secrets.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-destructive">
                {secrets.slice(0, 4).map((s, i) => (
                  <li key={i}>{s.label} <code className="font-mono text-xs">{s.excerpt}</code></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-destructive/90">Remplacez la valeur par le nom d'une variable, ex. <code className="font-mono">$WAVE_API_KEY</code>.</p>
            </>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Envoi…" : editSlug ? "Resoumettre pour validation" : "Soumettre pour validation"}
        </Button>
        <p className="text-xs text-muted-foreground">Le contexte est publié après relecture par un administrateur. Le serveur refait toutes ces vérifications.</p>
      </aside>
    </form>
  )
}
