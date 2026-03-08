import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonTableProps {
  columns?: number
  rows?: number
}

export function SkeletonTable({ columns = 5, rows = 8 }: SkeletonTableProps) {
  return (
    <div className="w-full space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={`cell-${rowIdx}-${colIdx}`} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
