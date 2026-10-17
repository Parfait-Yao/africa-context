import Image from "next/image"
import { serviceBrand } from "@/config/services"
import { cn } from "@/lib/utils"

const SIZES = { sm: 24, md: 36, lg: 48 } as const

/** Logo officiel du service ; monogramme coloré si le service n'a pas encore de logo. */
export function ServiceLogo({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  const brand = serviceBrand(name)
  const px = SIZES[size]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] border bg-white shadow-xs",
        className
      )}
      style={{ width: px, height: px }}
    >
      {brand ? (
        <Image src={brand.logo} alt="" width={px} height={px} className="size-full object-contain p-[12%]" />
      ) : (
        <span aria-hidden className="text-xs font-bold text-primary">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}
