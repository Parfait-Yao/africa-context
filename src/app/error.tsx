"use client"

import { Button } from "@/components/ui/button"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-24">
      <h1 className="text-2xl font-bold">La page n'a pas pu se charger.</h1>
      <p className="max-w-md text-muted-foreground">
        Une erreur est survenue côté serveur{error.digest ? ` (réf. ${error.digest})` : ""}. Réessayez ; si le problème persiste, signalez-le à l'équipe.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  )
}
