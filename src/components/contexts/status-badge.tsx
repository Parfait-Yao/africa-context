import { BadgeCheckIcon, ClockIcon, RefreshCwIcon, XCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS } from "@/config/site"
import type { ContextStatus } from "@/modules/contexts/context.types"
import { cn } from "@/lib/utils"

const styles: Record<ContextStatus, { className: string; Icon: typeof BadgeCheckIcon }> = {
  approved: { className: "border-transparent bg-success-soft text-success", Icon: BadgeCheckIcon },
  to_recheck: { className: "border-transparent bg-warning-soft text-warning", Icon: RefreshCwIcon },
  pending: { className: "border-transparent bg-muted text-muted-foreground", Icon: ClockIcon },
  rejected: { className: "border-transparent bg-danger-soft text-destructive", Icon: XCircleIcon },
}

export function StatusBadge({ status, className }: { status: ContextStatus; className?: string }) {
  const { className: c, Icon } = styles[status]
  return (
    <Badge variant="outline" className={cn(c, className)}>
      <Icon />
      {STATUS_LABELS[status]}
    </Badge>
  )
}
