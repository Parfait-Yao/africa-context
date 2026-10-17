"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  value: string
  /** Slug du contexte : si fourni, la copie est comptée (F16). */
  trackSlug?: string
  label?: string
  successMessage?: string
}

export function CopyButton({ value, trackSlug, label, successMessage = "Copié dans le presse-papiers", className, variant = "outline", size, ...props }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 1800)
      if (trackSlug) {
        fetch(`/api/contexts/${trackSlug}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "copy" }),
        }).catch(() => {})
      }
    } catch {
      toast.error("Copie impossible : sélectionnez le texte manuellement.")
    }
  }

  return (
    <Button type="button" variant={variant} size={size ?? (label ? "default" : "icon")} onClick={onCopy} className={cn(className)} aria-label={label ?? "Copier"} {...props}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {label && <span>{copied ? "Copié" : label}</span>}
    </Button>
  )
}
