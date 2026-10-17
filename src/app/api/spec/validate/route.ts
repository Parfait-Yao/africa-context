import { validateSubmission } from "@/modules/spec/spec.schema"
import { ok } from "@/lib/api"

/** POST /api/spec/validate — valide un contexte sans l'enregistrer (utile pour la CLI et le formulaire). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { data: _data, ...report } = validateSubmission(body)
  return ok(report)
}
