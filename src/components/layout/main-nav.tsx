"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { mainNav } from "@/config/site"
import { cn } from "@/lib/utils"

export function MainNav({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className={className} aria-label="Navigation principale">
      {mainNav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
              "after:absolute after:inset-x-3.5 after:-bottom-[13px] after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-300",
              active && "text-foreground after:scale-x-100"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}

export function MainNavFallback({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Navigation principale">
      {mainNav.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
          {item.title}
        </Link>
      ))}
    </nav>
  )
}
