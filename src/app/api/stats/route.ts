import { contextService } from "@/modules/contexts/context.service"
import { ok, handleError } from "@/lib/api"
import { connection } from "next/server"

/** GET /api/stats — compteurs d'impact globaux (F16). Le temps gagné est une estimation (minutesPerUse × usages, paramètre de la plateforme). */
export async function GET() {
  await connection()
  try {
    return ok(await contextService.impact())
  } catch (err) {
    return handleError(err)
  }
}
