import Link from "next/link"
import { cn } from "@/lib/utils"

/** `gradientId` doit être unique dans la page : un dégradé défini dans un élément masqué (display: none) ne s'affiche pas ailleurs. */
export function LogoMark({ className, gradientId = "ac-grad" }: { className?: string; gradientId?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-blue)" />
          <stop offset="0.55" stopColor="var(--brand-cyan)" />
          <stop offset="1" stopColor="var(--brand-violet)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      {/* Chevron "A" : le contexte injecté au-dessus du code */}
      <path d="M9 22.5 16 8.5l7 14" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.2 17.5h7.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="25.5" r="1.7" fill="#fff" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <LogoMark />
      <span className="text-[1.05rem] font-bold tracking-tight">
        Afri<span className="font-medium">Context</span>
      </span>
    </Link>
  )
}
