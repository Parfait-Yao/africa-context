import "dotenv/config"
import { defineConfig } from "prisma/config"

/**
 * URL utilisée par la CLI Prisma (migrations, seed, studio).
 * Connexion directe prioritaire (les migrations ne passent pas par un pooler) :
 * DATABASE_URL_UNPOOLED (fourni par Neon et l'intégration Vercel-Neon) ou DIRECT_URL.
 * L'application, elle, se connecte avec DATABASE_URL, poolée (src/lib/db.ts).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
})
