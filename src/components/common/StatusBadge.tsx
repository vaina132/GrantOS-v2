import { cn } from '@/lib/utils'
import { getStatusColor, getStatusDotColor } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        getStatusColor(status),
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', getStatusDotColor(status))} />
      {status}
    </span>
  )
}
