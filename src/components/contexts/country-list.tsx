import { countryName } from "@/config/site"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function CountryList({ codes, max = 4 }: { codes: string[]; max?: number }) {
  const visible = codes.slice(0, max)
  const rest = codes.length - visible.length
  return (
    <ul className="flex flex-wrap items-center gap-1" aria-label="Pays couverts">
      {visible.map((code) => (
        <li key={code}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-5 items-center rounded border px-1.5 font-mono text-[11px] text-muted-foreground">
                {code}
              </span>
            </TooltipTrigger>
            <TooltipContent>{countryName(code)}</TooltipContent>
          </Tooltip>
        </li>
      ))}
      {rest > 0 && <li className="text-xs text-muted-foreground">+{rest}</li>}
    </ul>
  )
}
