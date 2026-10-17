/** Erreur métier ou HTTP portée jusqu'à la réponse API (status + message lisible). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}
