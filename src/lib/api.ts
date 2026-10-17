import "server-only"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { HttpError } from "@/lib/errors"

/** Format de réponse homogène pour toutes les routes /api. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init)
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status })
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return fail(err.status, err.message, err.details)
  if (err instanceof ZodError) return fail(400, "Données invalides.", err.flatten())
  console.error("[api]", err instanceof Error ? err.message : err)
  return fail(500, "Erreur interne du serveur.")
}
