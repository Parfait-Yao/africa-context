"use client"

import { useRouter } from "next/navigation"
import { BanIcon, ShieldCheckIcon, ShieldOffIcon, UserCheckIcon, UserXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "./confirm-action"
import { useAdminAction } from "./use-admin-action"

/**
 * Rôle, suspension et retrait d'un compte. L'interface masque les actions impossibles, mais c'est le serveur
 * qui fait foi (propre compte, dernier administrateur, admin non suspendable, compte avec contextes non retirable).
 */
export function UserActions({
  id, name, email, role, suspended, isSelf, removable,
}: { id: string; name: string; email: string; role: "user" | "admin"; suspended: boolean; isSelf: boolean; removable: boolean }) {
  const router = useRouter()
  const { run, pending } = useAdminAction()
  const url = `/api/admin/users/${encodeURIComponent(id)}`

  if (isSelf) {
    return <p className="text-sm text-muted-foreground">C'est votre compte : un autre administrateur doit modifier votre rôle.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {role === "user" && !suspended && (
        <ConfirmAction
          trigger={<Button variant="outline" disabled={pending}><ShieldCheckIcon /> Nommer administrateur</Button>}
          title={`Donner le rôle administrateur à ${name} ?`}
          description="Ce compte pourra vérifier, valider, dépublier et supprimer des contextes, et gérer les autres utilisateurs. En contrepartie, il ne pourra plus publier ni modifier de contextes lui-même."
          confirmLabel="Nommer administrateur"
          onConfirm={() => run(url, { method: "PATCH", body: { role: "admin" } }, `${name} est administrateur`)}
          pending={pending}
        />
      )}
      {role === "admin" && (
        <ConfirmAction
          trigger={<Button variant="outline" disabled={pending}><ShieldOffIcon /> Retirer le rôle administrateur</Button>}
          title={`Retirer le rôle administrateur à ${name} ?`}
          description="Ce compte redevient un contributeur. Le dernier administrateur actif ne peut pas être rétrogradé."
          confirmLabel="Retirer le rôle"
          destructive
          onConfirm={() => run(url, { method: "PATCH", body: { role: "user" } }, `${name} n'est plus administrateur`)}
          pending={pending}
        />
      )}
      {role === "user" &&
        (suspended ? (
          <ConfirmAction
            trigger={<Button disabled={pending}><UserCheckIcon /> Réactiver le compte</Button>}
            title={`Réactiver le compte de ${name} ?`}
            description="La personne pourra de nouveau se connecter, publier, voter et signaler."
            confirmLabel="Réactiver"
            onConfirm={() => run(url, { method: "PATCH", body: { suspended: false } }, "Compte réactivé")}
            pending={pending}
          />
        ) : (
          <ConfirmAction
            trigger={<Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending}><BanIcon /> Suspendre</Button>}
            title={`Suspendre le compte de ${name} ?`}
            description="La connexion est refusée et toute action (publication, vote, signalement) est bloquée immédiatement. Ses contextes ne sont ni modifiés ni supprimés. Réversible à tout moment."
            confirmLabel="Suspendre"
            destructive
            onConfirm={() => run(url, { method: "PATCH", body: { suspended: true } }, "Compte suspendu")}
            pending={pending}
          />
        ))}
      {role === "user" &&
        (removable ? (
          <ConfirmAction
            trigger={<Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending}><UserXIcon /> Retirer le compte</Button>}
            title={`Retirer définitivement le compte de ${name} ?`}
            description="Le compte, ses votes et ses signalements sont supprimés. La personne ne pourra plus se connecter avec ce compte. Cette action est irréversible et journalisée."
            confirmLabel="Retirer le compte"
            destructive
            confirmText={email}
            onConfirm={async () => {
              const done = await run(url, { method: "DELETE" }, "Compte retiré")
              if (done) router.push("/admin/users")
              return done
            }}
            pending={pending}
          />
        ) : (
          <p className="basis-full text-xs text-muted-foreground">
            Ce compte a des contextes ou un historique de modération : il ne peut pas être retiré sans casser le catalogue. Suspendez-le si nécessaire.
          </p>
        ))}
    </div>
  )
}
