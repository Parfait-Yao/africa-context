import NextAuth, { type NextAuthConfig } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { usersService } from "@/modules/users/users.service"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Auth.js v5 — GitHub et Google OAuth (activés si leurs identifiants sont définis) + email / mot de passe (bcrypt).
 * Sessions JWT dans un cookie httpOnly (secure en production).
 */
const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

/**
 * Email GitHub *vérifié* (le principal de préférence). Le profil GitHub peut exposer un email
 * principal non vérifié : s'en servir pour relier les comptes permettrait de prendre celui d'un autre.
 */
async function githubVerifiedEmail(accessToken: string | undefined) {
  if (!accessToken) return null
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "africontext" },
  }).catch(() => null)
  if (!res?.ok) return null
  const emails = (await res.json().catch(() => [])) as { email: string; primary: boolean; verified: boolean }[]
  const verified = Array.isArray(emails) ? emails.filter((e) => e.verified) : []
  return (verified.find((e) => e.primary) ?? verified[0])?.email ?? null
}

export const githubEnabled =Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

const config: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    ...(githubEnabled ? [GitHub] : []),
    ...(googleEnabled ? [Google] : []),
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Mot de passe", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null
        // Anti force brute : 10 tentatives par email et par quart d'heure
        if (!rateLimit(`login:${parsed.data.email.toLowerCase()}`, 10, 15 * 60_000).ok) return null
        const user = await usersService.verifyCredentials(parsed.data.email, parsed.data.password)
        if (!user) return null
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    /** Google : refuse un email non vérifié (sinon on pourrait se rattacher au compte d'un autre). */
    signIn({ account, profile }) {
      if (account?.provider === "google") return (profile as { email_verified?: boolean } | undefined)?.email_verified === true
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const p = profile as { id?: number | string; login?: string; email?: string | null; name?: string | null; html_url?: string; avatar_url?: string }
        // Sans email vérifié : adresse noreply propre au compte GitHub, qui ne peut correspondre à aucun compte existant
        const email = (await githubVerifiedEmail(account.access_token)) ?? `${p.id}+${p.login}@users.noreply.github.com`
        const dbUser = await usersService.upsertGithubUser({
          githubId: String(p.id),
          email,
          name: p.name ?? p.login ?? "Développeur",
          githubUrl: p.html_url,
          image: p.avatar_url,
        })
        token.uid = dbUser.id
        token.role = dbUser.role
        token.name = dbUser.name
      } else if (account?.provider === "google" && profile) {
        const p = profile as { sub?: string; email?: string; name?: string | null; picture?: string }
        const dbUser = await usersService.upsertGoogleUser({
          googleId: String(p.sub),
          email: String(p.email),
          name: p.name ?? String(p.email).split("@")[0],
          image: p.picture,
        })
        token.uid = dbUser.id
        token.role = dbUser.role
        token.name = dbUser.name
      } else if (user) {
        token.uid = user.id
        token.role = (user as { role?: "user" | "admin" }).role ?? "user"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = (token.role as "user" | "admin") ?? "user"
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
