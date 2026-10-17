import { z } from "zod"

/** Variables d'environnement validées au démarrage. Voir .env.example. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(8).optional(),
  SANDBOX_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["anthropic", "openai"]).optional(),
  AI_BASE_URL: z.string().url().optional(),
})

export const env = envSchema.parse(process.env)
