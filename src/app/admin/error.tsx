"use client"

import { TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6">
      <TriangleAlertIcon className="size-6 text-destructive" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold">Cette page d'administration n'a pas pu se charger.</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Erreur côté serveur{error.digest ? ` (réf. ${error.digest})` : ""}. Vérifiez que la base de données est joignable, puis réessayez.
        </p>
      </div>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  )
}
