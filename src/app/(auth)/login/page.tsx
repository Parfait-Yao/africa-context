import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthForm } from "@/components/layout/auth-form"
import { githubEnabled, googleEnabled } from "@/auth"

export const metadata: Metadata = { title: "Se connecter" }

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthForm mode="login" githubEnabled={githubEnabled} googleEnabled={googleEnabled} />}>
      <WithParams searchParams={searchParams} />
    </Suspense>
  )
}

async function WithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined
  const error = typeof sp.error === "string" ? sp.error : undefined
  return <AuthForm mode="login" githubEnabled={githubEnabled} googleEnabled={googleEnabled} callbackUrl={callbackUrl} errorCode={error} />
}
