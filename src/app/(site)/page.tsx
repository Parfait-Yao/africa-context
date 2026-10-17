import { Suspense } from "react"
import Link from "next/link"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarCheckIcon,
  ClockIcon,
  DownloadIcon,
  FileCodeIcon,
  FlaskConicalIcon,
  GlobeIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  TrendingUpIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchForm } from "@/components/contexts/search-form"
import { InstallCommand } from "@/components/contexts/install-command"
import { ProofCompare } from "@/components/contexts/proof-compare"
import { ContextCard } from "@/components/contexts/context-card"
import { ServiceLogo } from "@/components/contexts/service-logo"
import { CountUp } from "@/components/contexts/count-up"
import { AboutSection } from "@/components/home/about-section"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { contextService } from "@/modules/contexts/context.service"
import { formatNumber } from "@/lib/format"

const steps = [
  { Icon: SearchIcon, title: "Cherchez le service", text: "Wave, Orange Money, FedaPay, une API SMS… filtrez par pays et par format." },
  { Icon: TerminalIcon, title: "Installez le contexte", text: "Une commande écrit le fichier au bon endroit : règle Cursor, CLAUDE.md ou AGENTS.md." },
  { Icon: SparklesIcon, title: "Laissez l'IA coder", text: "Votre assistant s'appuie sur les vrais endpoints, champs et erreurs du service." },
  { Icon: FlaskConicalIcon, title: "Testez contre la sandbox", text: "Le code généré s'exécute contre un faux serveur réaliste, webhooks compris." },
]

const guarantees = [
  { Icon: FileCodeIcon, title: "Source officielle", text: "Lien vers la documentation d'où vient chaque endpoint." },
  { Icon: BadgeCheckIcon, title: "Version d'API", text: "Le contexte dit pour quelle version il a été écrit." },
  { Icon: CalendarCheckIcon, title: "Date de vérification", text: "Un contexte trop ancien passe en « À revérifier »." },
  { Icon: FlaskConicalIcon, title: "Preuve avant / après", text: "La sortie de l'IA sans contexte, puis avec, sur le même prompt." },
]

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}

function HomeSkeleton() {
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-2">
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

/** Données lues à la requête (PostgreSQL) : la coque de page reste statique. */
async function HomeContent() {
  await connection()
  const [featured, facets, impact, wave] = await Promise.all([
    contextService.featured(6),
    contextService.facets(),
    contextService.impact(),
    contextService.getBySlug("wave-checkout-api"),
  ])
  const heroProof = wave?.proofs[0]

  return (
    <>
      {/* Hero : le problème et la solution, montrés plutôt que décrits */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="animate-drift absolute -top-40 -left-32 -z-10 size-[30rem] rounded-full bg-brand-blue/25 blur-3xl" />
        <div aria-hidden className="animate-drift absolute top-20 -right-40 -z-10 size-[26rem] rounded-full bg-brand-violet/20 blur-3xl [animation-delay:-7s]" />
        <div aria-hidden className="animate-drift absolute -bottom-40 left-1/3 -z-10 size-[22rem] rounded-full bg-brand-cyan/20 blur-3xl [animation-delay:-3s]" />

        <div className="container-page grid grid-cols-1 items-center gap-14 py-16 lg:grid-cols-[1fr_1.05fr] lg:py-24">
          <div className="min-w-0 max-w-xl">
            <Link
              href="/contexts"
              className="rise-in group inline-flex max-w-full items-center gap-2 rounded-full border bg-card/80 py-1 pr-3 pl-1 text-sm shadow-xs backdrop-blur transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                {formatNumber(impact.contexts)} contextes
              </span>
              <span className="truncate text-muted-foreground">vérifiés sur les docs officielles</span>
              <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <h1
              className="rise-in mt-6 text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[3.6rem]"
              style={{ "--d": "80ms" } as React.CSSProperties}
            >
              Votre IA ne connaît pas Wave. <span className="text-brand-gradient">Donnez‑lui le bon contexte.</span>
            </h1>
            <p className="rise-in mt-5 text-lg text-pretty text-muted-foreground" style={{ "--d": "160ms" } as React.CSSProperties}>
              AfriContext réunit des contextes vérifiés sur les documentations officielles des services africains — paiement mobile,
              agrégateurs, SMS — à installer dans Cursor ou Claude Code en une commande.
            </p>
            <div className="rise-in" style={{ "--d": "240ms" } as React.CSSProperties}>
              <SearchForm className="mt-8 shadow-lg shadow-primary/5" />
            </div>
            <div className="rise-in mt-6" style={{ "--d": "320ms" } as React.CSSProperties}>
              <p className="mb-2 text-sm text-muted-foreground">Ou installez directement le contexte Wave :</p>
              <InstallCommand slug="wave-checkout-api" />
            </div>
            <div className="rise-in mt-7 flex items-center gap-3" style={{ "--d": "400ms" } as React.CSSProperties}>
              <div className="flex shrink-0 -space-x-2">
                {facets.services.slice(0, 5).map((s) => (
                  <ServiceLogo key={s.name} name={s.name} size="sm" className="size-8! rounded-full ring-2 ring-background" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {facets.services.slice(0, 2).map((s) => s.name).join(", ")} et {Math.max(0, facets.services.length - 2)} autres services
              </p>
            </div>
          </div>

          {heroProof && (
            <div className="rise-in relative min-w-0" style={{ "--d": "200ms" } as React.CSSProperties}>
              <div aria-hidden className="bg-brand-gradient absolute -inset-4 -z-10 rounded-3xl opacity-20 blur-2xl" />
              <div className="animate-float rounded-2xl border bg-card/80 p-3 shadow-2xl backdrop-blur">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="size-3 shrink-0 rounded-full bg-[#ff5f57]" />
                  <span className="size-3 shrink-0 rounded-full bg-[#febc2e]" />
                  <span className="size-3 shrink-0 rounded-full bg-[#28c840]" />
                  <p className="ml-2 min-w-0 truncate text-xs text-muted-foreground">« {heroProof.prompt} » · même prompt, même modèle</p>
                </div>
                <ProofCompare proof={heroProof} compact />
              </div>
              <div className="animate-float absolute -top-5 -left-5 hidden rounded-2xl border bg-card p-2 shadow-xl sm:block [animation-delay:-2s]">
                <ServiceLogo name="Wave" size="lg" className="border-0 shadow-none" />
              </div>
              <div className="animate-float absolute -right-4 -bottom-5 hidden rounded-2xl border bg-card p-2 shadow-xl sm:block [animation-delay:-4s]">
                <ServiceLogo name="Orange Money" size="lg" className="border-0 shadow-none" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Services couverts : bandeau défilant de logos (pause au survol) */}
      <section aria-labelledby="services-title" className="border-b bg-card py-6">
        <h2 id="services-title" className="container-page mb-4 text-center text-sm font-medium text-muted-foreground">
          {facets.services.length} services couverts, de Dakar à Nairobi
        </h2>
        <div className="group mask-fade-x relative overflow-hidden">
          <div className="animate-marquee flex w-max gap-3 group-hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex gap-3">
                {facets.services.map((s) => (
                  <li key={s.name}>
                    <Link
                      href={`/contexts?q=${encodeURIComponent(s.name)}`}
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="group/logo inline-flex h-12 items-center gap-2.5 rounded-full border bg-background py-1 pr-5 pl-1.5 text-sm font-medium whitespace-nowrap transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-95"
                    >
                      <ServiceLogo name={s.name} className="rounded-full transition-transform group-hover/logo:scale-110" />
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      <AboutSection stats={{ services: facets.services.length, countries: impact.countries, contexts: impact.contexts }} />

      {/* Comment ça marche : une vraie séquence, donc numérotée */}
      <section aria-labelledby="how-title" className="container-page py-16 lg:py-20">
        <h2 id="how-title" className="reveal text-2xl font-bold tracking-tight sm:text-3xl">De la recherche au code qui passe les tests</h2>
        <ol className="reveal-stagger mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ Icon, ...step }, i) => (
            <li
              key={step.title}
              className="group relative rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-3xl font-bold text-muted-foreground/25">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Contextes les plus installés */}
      <section aria-labelledby="featured-title" className="border-y bg-muted/40">
        <div className="container-page py-16 lg:py-20">
          <div className="reveal flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Les plus installés</h2>
            <Button asChild variant="outline" className="group/button">
              <Link href="/contexts">
                Tout le catalogue <ArrowRightIcon className="transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <ul className="reveal-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <li key={c.slug}>
                <ContextCard context={c} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Confiance */}
      <section aria-labelledby="trust-title" className="container-page grid grid-cols-1 gap-10 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-20">
        <div className="reveal max-w-md">
          <h2 id="trust-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Un contexte se vérifie avant de s'installer</h2>
          <p className="mt-4 text-muted-foreground">
            Chaque fiche suit l'AfriContext Spec : huit sections obligatoires, de l'authentification aux pièges que les LLMs
            inventent le plus souvent. Aucune soumission n'est publiée sans relecture.
          </p>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link href="/docs#spec">Lire la Spec</Link>
          </Button>
        </div>
        <dl className="reveal-stagger grid gap-4 sm:grid-cols-2">
          {guarantees.map(({ Icon, title, text }) => (
            <div key={title} className="group rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <dt className="flex items-center gap-3 font-semibold">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                {title}
              </dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TestimonialsSection />

      {/* Impact + contribution */}
      <section aria-labelledby="impact-title" className="relative isolate overflow-hidden bg-code-bg text-code-fg">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_30%,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div aria-hidden className="animate-drift absolute -top-32 left-1/4 -z-10 size-[28rem] rounded-full bg-brand-blue/30 blur-3xl" />
        <div aria-hidden className="animate-drift absolute -right-24 bottom-0 -z-10 size-[24rem] rounded-full bg-brand-violet/25 blur-3xl [animation-delay:-6s]" />

        <div className="container-page py-20 lg:py-24">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-code-fg/85">
              <TrendingUpIcon className="size-3.5 text-[#86efac]" aria-hidden /> Impact en direct
            </span>
            <h2 id="impact-title" className="mt-4 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
              Des heures rendues aux développeurs, <span className="text-brand-gradient">contexte après contexte.</span>
            </h2>
          </div>

          <dl className="reveal-stagger mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { Icon: FileCodeIcon, label: "contextes publiés", value: impact.contexts },
              { Icon: GlobeIcon, label: "pays couverts", value: impact.countries },
              { Icon: DownloadIcon, label: "installations", value: impact.installs },
              { Icon: ClockIcon, label: "heures gagnées (est.)", value: impact.hoursSaved },
            ].map(({ Icon, label, value }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]"
              >
                <div aria-hidden className="bg-brand-gradient absolute -top-16 -right-16 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#7dd3fc] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon className="size-5" aria-hidden />
                </span>
                <dd className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  <CountUp value={value} />
                </dd>
                <dt className="mt-1 text-sm text-code-fg/65">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-center text-xs text-code-fg/45">Estimation : 25 minutes économisées par copie ou installation.</p>

          {/* Appel à contribution : bordure en dégradé */}
          <div className="reveal bg-brand-gradient mt-14 rounded-3xl p-px shadow-2xl shadow-brand-blue/20">
            <div className="flex flex-col gap-8 rounded-[calc(1.5rem-1px)] bg-code-bg/95 p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <div className="max-w-xl">
                <div className="flex -space-x-2">
                  {facets.services.slice(0, 6).map((s) => (
                    <ServiceLogo key={s.name} name={s.name} size="sm" className="size-9! rounded-full ring-2 ring-code-bg" />
                  ))}
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-white">Vous avez déjà intégré un service local ?</h3>
                <p className="mt-2 text-code-fg/70">
                  Publiez votre contexte en moins d'une minute. Le formulaire vérifie la Spec et bloque les clés d'API laissées en clair.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button asChild size="lg" className="group/cta bg-white text-[#0f1834] shadow-lg hover:bg-white/90">
                  <Link href="/submit">
                    Publier un contexte <ArrowRightIcon className="transition-transform group-hover/cta:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                  <Link href="/docs#spec">Lire la Spec</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
