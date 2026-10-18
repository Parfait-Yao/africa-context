import Link from "next/link"
import { connection } from "next/server"
import { Button } from "@/components/ui/button"
import { getSession } from "@/modules/auth/session"
import { UserMenuDropdown } from "./user-menu-dropdown"

/** Partie du header qui dépend de la session (rendue à la requête, sous Suspense). */
export async function UserMenu() {
  await connection()
  const user = await getSession()
  if (!user) return <GuestActions />
  return (
    <>
      {user.role !== "admin" && (
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/submit">Publier un contexte</Link>
        </Button>
      )}
      <UserMenuDropdown name={user.name || user.email} email={user.email} isAdmin={user.role === "admin"} />
    </>
  )
}

export function GuestActions() {
  return (
    <>
      <Button asChild variant="ghost" className="hidden sm:inline-flex">
        <Link href="/login">Se connecter</Link>
      </Button>
      <Button asChild className="hidden sm:inline-flex">
        <Link href="/submit">Publier un contexte</Link>
      </Button>
    </>
  )
}
