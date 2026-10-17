import { NextResponse } from "next/server"
import { auth } from "@/auth"

/**
 * Première barrière d'accès (Next 16 : proxy = ancien middleware).
 * Les routes API refont toujours leur propre contrôle (requireUser / requireAdmin).
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const user = req.auth?.user
  const needsUser = ["/dashboard", "/submit", "/admin"].some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const needsAdmin = pathname === "/admin" || pathname.startsWith("/admin/")

  if (needsUser && !user) {
    const url = new URL("/login", req.nextUrl)
    url.searchParams.set("callbackUrl", pathname + search)
    return NextResponse.redirect(url)
  }
  if (needsAdmin && user?.role !== "admin") return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  return NextResponse.next()
})

export const config = {
  matcher: ["/dashboard/:path*", "/submit/:path*", "/admin/:path*"],
}
