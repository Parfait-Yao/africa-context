import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthForm } from "@/components/layout/auth-form"
import { githubEnabled, googleEnabled } from "@/auth"

export const metadata: Metadata = { title: "Créer un compte" }

export default function Page({ searchParams }: PageProps<"/register">) {
  return (
    <Suspense fallback={<AuthForm mode="register" githubEnabled={githubEnabled} googleEnabled={googleEnabled} />}>
      <WithParams searchParams={searchParams} />
    </Suspense>
  )
}

async function WithParams({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const sp = await searchParams
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined
  const error = typeof sp.error === "string" ? sp.error : undefined
  return <AuthForm mode="register" githubEnabled={githubEnabled} googleEnabled={googleEnabled} callbackUrl={callbackUrl} errorCode={error} />
}
