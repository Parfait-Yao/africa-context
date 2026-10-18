import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { HttpError } from "@/lib/errors"

export { HttpError }
export type Role = "user" | "admin"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

/** Session courante (Auth.js). `null` si non connecté. */
export async function getSession(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role ?? "user",
  }
}

/** État du compte relu en base : la session JWT peut dater de 14 jours. */
const loadAccount = (id: string) => prisma.user.findUnique({ where: { id }, select: { role: true, suspendedAt: true } })

/**
 * Toute action authentifiée : le compte doit exister et ne pas être suspendu.
 * Le rôle renvoyé est celui de la base (un rôle retiré prend effet immédiatement).
 */
export async function requireUser() {
  const user = await getSession()
  if (!user) throw new HttpError(401, "Connexion requise.")
  const db = await loadAccount(user.id)
  if (!db) throw new HttpError(401, "Connexion requise.")
  if (db.suspendedAt) throw new HttpError(403, "Votre compte est suspendu.")
  return { ...user, role: db.role }
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "admin") throw new HttpError(403, "Réservé aux administrateurs.")
  return { ...user, role: "admin" as const }
}

/**
 * Variante pour les pages de l'espace admin : redirige au lieu de lever une erreur HTTP.
 * À appeler dans chaque page (un layout ne se ré-exécute pas à chaque navigation).
 */
export async function requireAdminPage(callbackUrl = "/admin") {
  const user = await getSession()
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  const db = await loadAccount(user.id)
  if (db?.role !== "admin" || db.suspendedAt) redirect("/dashboard")
  return { ...user, role: "admin" as const }
}
