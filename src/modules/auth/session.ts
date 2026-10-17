import "server-only"
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

export async function requireUser() {
  const user = await getSession()
  if (!user) throw new HttpError(401, "Connexion requise.")
  return user
}

/** Le rôle admin est revérifié en base : un rôle retiré prend effet immédiatement. */
export async function requireAdmin() {
  const user = await requireUser()
  const db = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
  if (db?.role !== "admin") throw new HttpError(403, "Réservé aux administrateurs.")
  return { ...user, role: "admin" as const }
}
