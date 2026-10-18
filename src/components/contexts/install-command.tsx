"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { CopyButton } from "./copy-button"
import { INSTALL_ENVS, INSTALL_ENV_KEYS, ruleFilePaths, type InstallEnv } from "@/modules/contexts/install-plan"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "africontext:install-env"

/**
 * Barre de commande d'installation : l'élément signature de l'interface.
 * Seul endroit (avec le logo) qui porte le dégradé de marque.
 * Avec `showFormats`, l'utilisateur choisit son environnement (mémorisé) et voit ce que la commande installe.
 */
export function InstallCommand({
  slug,
  showFormats = false,
  envVars = [],
  className,
}: {
  slug: string
  showFormats?: boolean
  /** Variables déclarées par le contexte, pour annoncer ce qui sera ajouté au .env. */
  envVars?: string[]
  className?: string
}) {
  const [env, setEnv] = React.useState<InstallEnv>("cursor")

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de la préférence au montage
      if (saved && saved in INSTALL_ENVS) setEnv(saved as InstallEnv)
    } catch {}
  }, [])

  const choose = (next: InstallEnv) => {
    setEnv(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  const command = `npx africontext add ${slug}${showFormats ? ` --env ${env}` : ""}`

  return (
    <div className={cn("space-y-2", className)}>
      {showFormats && (
        <div role="radiogroup" aria-label="Votre environnement" className="flex flex-wrap gap-1">
          {INSTALL_ENV_KEYS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={env === e}
              title={INSTALL_ENVS[e].hint}
              onClick={() => choose(e)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                env === e && "bg-secondary text-foreground"
              )}
            >
              {INSTALL_ENVS[e].label}
            </button>
          ))}
        </div>
      )}
      <div className="bg-brand-gradient rounded-lg p-px">
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-1px)] bg-code-bg py-1.5 pr-1.5 pl-4 text-code-fg">
          <span aria-hidden className="font-mono text-sm text-[#7dd3fc] select-none">$</span>
          <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap [scrollbar-width:none]">{command}</code>
          <CopyButton
            value={command}
            trackSlug={slug}
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-code-fg hover:bg-white/10 hover:text-white"
            successMessage="Commande copiée : lancez-la à la racine de votre projet"
          />
        </div>
      </div>
      {showFormats && (
        <div className="text-xs text-muted-foreground">
          <p>À lancer dans le terminal, à la racine de votre projet. Elle installe :</p>
          <ul className="mt-1 space-y-0.5">
            <li className="flex gap-1.5">
              <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
              <span>
                Les règles de votre agent, adaptées à votre framework :{" "}
                {ruleFilePaths(env, slug).map((p, i) => (
                  <React.Fragment key={p}>
                    {i > 0 && ", "}
                    <code className="font-mono">{p}</code>
                  </React.Fragment>
                ))}
              </span>
            </li>
            {envVars.length > 0 && (
              <li className="flex gap-1.5">
                <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
                <span>
                  Les variables à remplir dans votre <code className="font-mono">.env</code> :{" "}
                  <span className="font-mono [overflow-wrap:anywhere]">{envVars.join(", ")}</span>
                </span>
              </li>
            )}
            <li className="flex gap-1.5">
              <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
              <span>Votre fichier <code className="font-mono">.env</code> protégé dans <code className="font-mono">.gitignore</code>.</span>
            </li>
          </ul>
          <p className="mt-1">Ensuite, renseignez vos clés et demandez simplement à votre agent d'intégrer le service.</p>
        </div>
      )}
    </div>
  )
}
