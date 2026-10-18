import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SubmitForm } from "@/components/submit/submit-form"
import { contextService } from "@/modules/contexts/context.service"
import { getSession } from "@/modules/auth/session"
import { aiEnabled } from "@/lib/ai"

export const metadata: Metadata = {
  title: "Publier un contexte",
  description: "Partagez un contexte vérifié pour un service africain. Validation de la Spec et scan de secrets automatiques.",
}

export default function SubmitPage({ searchParams }: PageProps<"/submit">) {
  return (
    <div className="container-page py-10 lg:py-14">
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <SubmitContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SubmitContent({ searchParams }: Pick<PageProps<"/submit">, "searchParams">) {
  await connection()
  const user = await getSession()
  if (!user) redirect("/login?callbackUrl=/submit")
  // Séparation des rôles : l'API refuse aussi la soumission et la correction par un administrateur
  if (user.role === "admin") {
    return (
      <div className="max-w-2xl rounded-xl border bg-card p-8">
        <ShieldCheckIcon className="size-8 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Les administrateurs ne publient pas de contextes</h1>
        <p className="mt-2 text-muted-foreground">
          Votre rôle est de contrôler, vérifier et valider les contributions de la communauté. Pour qu&apos;un contexte soit corrigé,
          rejetez-le avec un motif précis : son auteur le modifiera et le resoumettra.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild><Link href="/admin/moderation">File de modération</Link></Button>
          <Button asChild variant="outline"><Link href="/admin">Tableau de bord</Link></Button>
        </div>
      </div>
    )
  }
  const sp = await searchParams
  const editSlug = typeof sp.edit === "string" ? sp.edit : undefined

  let initial
  let rejectionReason: string | undefined
  if (editSlug) {
    const ctx = await contextService.getForOwner(editSlug)
    if (!ctx || ctx.author.id !== user.id) notFound()
    rejectionReason = ctx.status === "rejected" ? ctx.rejectionReason : undefined
    initial = {
      title: ctx.title,
      slug: ctx.slug,
      description: ctx.description,
      type: ctx.type,
      service: ctx.service,
      category: ctx.category,
      pays: ctx.countries,
      version_api: ctx.apiVersion,
      source_url: ctx.sourceUrl,
      tested_with: ctx.testedWith,
      tagsInput: ctx.tags.join(", "),
      content: ctx.content,
    }
  }

  return (
    <>
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{editSlug ? "Corriger un contexte" : "Publier un contexte"}</h1>
        <p className="mt-3 text-muted-foreground">
          {editSlug
            ? "Vos modifications créent une nouvelle version. Le contexte repasse en attente de validation."
            : "Décrivez comment intégrer un service tel qu'il fonctionne vraiment. Le panneau de droite vous indique en direct ce qui manque pour respecter la Spec."}
        </p>
      </header>
      <div className="mt-10">
        <SubmitForm initial={initial} editSlug={editSlug} rejectionReason={rejectionReason} aiEnabled={aiEnabled()} />
      </div>
    </>
  )
}
