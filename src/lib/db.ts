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

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
