import { connection } from "next/server"
import { prisma } from "@/lib/db"

/** Santé de l'application et de la base (Docker, reverse proxy, recette). */
export async function GET() {
  await connection()
  let database = "ok"
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    database = "down"
  }
  return Response.json(
    { status: database === "ok" ? "ok" : "degraded", service: "africontext", database, time: new Date().toISOString() },
    { status: database === "ok" ? 200 : 503 }
  )
}
