import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_DOT, PRIORITY_LABELS } from '@/lib/constants'
import type { TicketStatus, TicketPriority } from '@/lib/types'

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={cn('badge', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[priority])} />
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

