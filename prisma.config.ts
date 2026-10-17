import "dotenv/config"
import { defineConfig } from "prisma/config"

/**
 * URL utilisée par la CLI Prisma (migrations, seed, studio).
 * DIRECT_URL (connexion directe, ex. Neon sans « -pooler ») est prioritaire : les migrations
 * ne passent pas par un pooler. L'application, elle, se connecte avec DATABASE_URL (src/lib/db.ts).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
})
