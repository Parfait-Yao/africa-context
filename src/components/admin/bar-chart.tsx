import { formatNumber } from "@/lib/format"

const fmt = {
  day: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }),
  week: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }),
  month: new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }),
}

export function bucketLabel(iso: string, unit: "day" | "week" | "month") {
  const label = fmt[unit].format(new Date(iso))
  return unit === "week" ? `sem. du ${label}` : label
}

/**
 * Histogramme d'une seule série (rendu serveur, sans bibliothèque) : barres fines arrondies au sommet,
 * infobulle au survol et au focus clavier, et tableau des valeurs pour les lecteurs d'écran.
 */
export function BarChart({
  title,
  series,
  unit,
  valueLabel,
}: {
  title: string
  series: { start: string; value: number }[]
  unit: "day" | "week" | "month"
  valueLabel: string
}) {
  const max = Math.max(1, ...series.map((s) => s.value))
  const total = series.reduce((n, s) => n + s.value, 0)
  return (
    <figure className="rounded-xl border bg-card p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{formatNumber(total)} au total</span>
      </figcaption>
      {total === 0 ? (
        <p className="flex h-36 items-center justify-center text-sm text-muted-foreground">Aucune donnée sur la période.</p>
      ) : (
        <div className="mt-4">
          <div className="flex h-36 items-end gap-[2px] border-b border-border" aria-hidden="true">
            {series.map((s) => (
              <div key={s.start} className="group relative flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
                  style={{ height: s.value ? `${Math.max(2, (s.value / max) * 100)}%` : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm group-hover:block">
                  {bucketLabel(s.start, unit)} : <span className="font-semibold tabular-nums">{formatNumber(s.value)}</span> {valueLabel}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground" aria-hidden="true">
            <span>{bucketLabel(series[0].start, unit)}</span>
            <span>max {formatNumber(max)}</span>
            <span>{bucketLabel(series.at(-1)!.start, unit)}</span>
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir les valeurs</summary>
            <table className="mt-2 w-full text-left">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1 font-medium">Période</th>
                  <th scope="col" className="py-1 text-right font-medium">{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.start} className="border-t">
                    <td className="py-1">{bucketLabel(s.start, unit)}</td>
                    <td className="py-1 text-right tabular-nums">{formatNumber(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </figure>
  )
}

/** Barres horizontales classées (une seule couleur : la longueur porte la valeur). */
export function RankedBars({ items, valueLabel }: { items: { label: React.ReactNode; key: string; value: number; hint?: string }[]; valueLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span className="truncate">{i.label}</span>
          <span className="text-right tabular-nums">
            <span className="font-semibold">{formatNumber(i.value)}</span> <span className="text-xs text-muted-foreground">{valueLabel}</span>
          </span>
          <span className="col-span-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          {i.hint && <span className="col-span-2 text-xs text-muted-foreground">{i.hint}</span>}
        </li>
      ))}
    </ol>
  )
}
