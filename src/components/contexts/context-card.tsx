import Link from "next/link"
import { DownloadIcon, FlaskConicalIcon, GitCompareArrowsIcon } from "lucide-react"
import type { Context } from "@/modules/contexts/context.types"
import { CONTEXT_TYPE_LABELS } from "@/config/site"
import { formatDate, formatNumber } from "@/lib/format"
import { StatusBadge } from "./status-badge"
import { CountryList } from "./country-list"
import { ServiceLogo } from "./service-logo"

type CardContext = Pick<
  Context,
  "slug" | "title" | "description" | "service" | "type" | "countries" | "status" | "lastVerifiedAt" | "stats" | "apiVersion" | "hasSandbox"
> & { proofs?: Context["proofs"] }

export function ContextCard({ context }: { context: CardContext }) {
  const hasProof = (context.proofs?.length ?? 0) > 0
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2.5 text-sm font-semibold">
          <ServiceLogo name={context.service} className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
          {context.service}
        </p>
        <StatusBadge status={context.status} />
      </div>
      <h3 className="mt-2 text-lg leading-snug font-semibold tracking-tight">
        <Link href={`/contexts/${context.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
          {context.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{context.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="font-mono">{CONTEXT_TYPE_LABELS[context.type]}</span>
        <span className="font-mono">API {context.apiVersion}</span>
        {hasProof && (
          <span className="inline-flex items-center gap-1 text-success">
            <GitCompareArrowsIcon className="size-3.5" /> Preuve avant/après
          </span>
        )}
        {context.hasSandbox && (
          <span className="inline-flex items-center gap-1">
            <FlaskConicalIcon className="size-3.5" /> Sandbox
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 mt-5">
        <CountryList codes={context.countries} />
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Installations">
            <DownloadIcon className="size-3.5" />
            {formatNumber(context.stats.installs)}
          </span>
          <time dateTime={context.lastVerifiedAt} title="Dernière vérification">
            {formatDate(context.lastVerifiedAt)}
          </time>
        </div>
      </div>
    </article>
  )
}
