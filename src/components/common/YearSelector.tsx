import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/uiStore'
import { getYearOptions, cn } from '@/lib/utils'

interface YearSelectorProps {
  className?: string
}

export function YearSelector({ className }: YearSelectorProps) {
  const { globalYear, setGlobalYear } = useUiStore()
  const yearOptions = getYearOptions()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setGlobalYear(globalYear - 1)}
        disabled={globalYear <= yearOptions[0]}
        aria-label="Previous year"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
        {yearOptions.filter(y => Math.abs(y - globalYear) <= 2).map((year) => (
          <button
            key={year}
            onClick={() => setGlobalYear(year)}
            className={cn(
              'rounded-md px-2.5 py-0.5 text-xs font-semibold transition-all',
              year === globalYear
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {year}
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setGlobalYear(globalYear + 1)}
        disabled={globalYear >= yearOptions[yearOptions.length - 1]}
        aria-label="Next year"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
