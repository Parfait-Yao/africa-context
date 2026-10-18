import "server-only"
import { Pool } from "pg"
import { attachDatabasePool } from "@vercel/functions"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

/**
 * Client Prisma unique (évite d'ouvrir un pool par rechargement en développement).
 * node-postgres + URL poolée Neon (« -pooler ») ; sur Vercel (Fluid compute), attachDatabasePool
 * ferme les connexions inactives avant la suspension de la fonction. Hors Vercel, c'est sans effet.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL manquant : copiez .env.example vers .env.")
  const pool = new Pool({ connectionString })
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

/**
 * Après `prisma generate`, le rechargement à chaud charge une nouvelle classe PrismaClient : l'instance
 * mise en cache, créée avec l'ancien schéma, ignorerait les nouveaux modèles. On la remplace alors.
 */
function cachedClient() {
  const cached = globalForPrisma.prisma
  if (cached && cached instanceof PrismaClient) return cached
  // Ancienne instance : on libère son pool de connexions
  if (cached) void (cached as { $disconnect(): Promise<void> }).$disconnect().catch(() => {})
  return createClient()
}

export const prisma = cachedClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
