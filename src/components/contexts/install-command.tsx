"use client"

import * as React from "react"
import { CopyButton } from "./copy-button"
import { cn } from "@/lib/utils"

const FORMATS = [
  { value: "cursorrules", label: "Cursor" },
  { value: "claude", label: "Claude Code" },
  { value: "agents", label: "AGENTS.md" },
] as const

/**
 * Barre de commande d'installation : l'élément signature de l'interface.
 * Seul endroit (avec le logo) qui porte le dégradé de marque.
 */
export function InstallCommand({ slug, showFormats = false, className }: { slug: string; showFormats?: boolean; className?: string }) {
  const [format, setFormat] = React.useState<(typeof FORMATS)[number]["value"]>("cursorrules")
  const command = `npx africontext add ${slug}${showFormats && format !== "cursorrules" ? ` --format ${format}` : ""}`

  return (
    <div className={cn("space-y-2", className)}>
      {showFormats && (
        <div role="radiogroup" aria-label="Outil cible" className="flex flex-wrap gap-1">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={format === f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                format === f.value && "bg-secondary text-foreground"
              )}
            >
              {f.label}
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
            successMessage="Commande copiée"
          />
        </div>
      </div>
    </div>
  )
}
