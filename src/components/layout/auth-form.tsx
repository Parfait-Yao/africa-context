"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldSeparator, FieldDescription, FieldError } from "@/components/ui/field"
import { GithubIcon } from "./github-icon"
import { GoogleIcon } from "./google-icon"

type Provider = "github" | "google"

const PROVIDERS: { id: Provider; label: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactNode; envVar: string }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon, envVar: "AUTH_GOOGLE_ID" },
  { id: "github", label: "GitHub", Icon: GithubIcon, envVar: "AUTH_GITHUB_ID" },
]

/** Connexion / inscription (Auth.js : Google, GitHub + email / mot de passe). */
export function AuthForm({
  mode,
  githubEnabled,
  googleEnabled,
  callbackUrl = "/dashboard",
  errorCode,
}: {
  mode: "login" | "register"
  githubEnabled: boolean
  googleEnabled: boolean
  callbackUrl?: string
  errorCode?: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(
    errorCode === "OAuthAccountNotLinked"
      ? "Ce compte est déjà lié à un autre utilisateur."
      : errorCode === "AccessDenied"
        ? "Connexion refusée : l'email du compte doit être vérifié."
        : errorCode ? "La connexion a échoué. Réessayez." : null
  )
  const isLogin = mode === "login"
  const enabled: Record<Provider, boolean> = { github: githubEnabled, google: googleEnabled }
  // En production, seuls les fournisseurs configurés apparaissent ; en dev, tous (avec un rappel de configuration)
  const providers = PROVIDERS.filter((p) => enabled[p.id] || process.env.NODE_ENV !== "production")
  const [oauthPending, setOauthPending] = React.useState<Provider | null>(null)

  function oauth(provider: (typeof PROVIDERS)[number]) {
    if (!enabled[provider.id]) {
      toast.error(`Connexion ${provider.label} pas encore configurée`, { description: `Renseignez ${provider.envVar} et son secret dans .env.` })
      return
    }
    setOauthPending(provider.id)
    signIn(provider.id, { redirectTo: safeCallback })
  }
  // Chemin interne uniquement : « //hote » et « /\hote » mèneraient hors du site (redirection ouverte)
  const safeCallback = /^\/(?![/\\])/.test(callbackUrl) && !/[\\\s]/.test(callbackUrl) ? callbackUrl : "/dashboard"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    setPending(true)

    if (!isLogin) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email, password }),
      }).catch(() => null)
      const json = await res?.json().catch(() => null)
      if (!res?.ok) {
        setPending(false)
        const fieldErrors = json?.error?.details?.fieldErrors as Record<string, string[]> | undefined
        setError(fieldErrors ? Object.values(fieldErrors).flat()[0] : json?.error?.message ?? "Inscription impossible.")
        return
      }
      toast.success("Compte créé")
    }

    const result = await signIn("credentials", { email, password, redirect: false })
    setPending(false)
    if (result?.error) {
      setError("Email ou mot de passe incorrect.")
      return
    }
    router.push(safeCallback)
    router.refresh()
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isLogin ? "Se connecter" : "Créer un compte"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLogin ? "Pour publier, voter et signaler des contextes." : "Un compte suffit pour publier votre premier contexte."}
        </p>
      </div>
      {providers.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {providers.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="lg"
                disabled={oauthPending !== null}
                onClick={() => oauth(p)}
                aria-label={`${isLogin ? "Se connecter" : "S'inscrire"} avec ${p.label}`}
                className="transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p.Icon className="size-4" /> {oauthPending === p.id ? "Redirection…" : p.label}
              </Button>
            ))}
          </div>
          <FieldSeparator>ou par email</FieldSeparator>
        </>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {!isLogin && (
            <Field>
              <FieldLabel htmlFor="name">Nom</FieldLabel>
              <Input id="name" name="name" autoComplete="name" required minLength={2} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required />
            {!isLogin && <FieldDescription>8 caractères minimum.</FieldDescription>}
          </Field>
          {error && <FieldError role="alert">{error}</FieldError>}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Un instant…" : isLogin ? "Se connecter" : "Créer mon compte"}
          </Button>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "Pas encore de compte ? " : "Déjà inscrit ? "}
        <Link href={`${isLogin ? "/register" : "/login"}?callbackUrl=${encodeURIComponent(safeCallback)}`} className="font-medium text-primary hover:underline">
          {isLogin ? "Créer un compte" : "Se connecter"}
        </Link>
      </p>
    </div>
  )
}
