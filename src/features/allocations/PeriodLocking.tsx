import { useState } from 'react'
import { allocationsService } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { usePeriodLocks } from '@/hooks/useAllocations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function PeriodLocking() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const { isLoading, isLocked, refetch } = usePeriodLocks()
  const [toggling, setToggling] = useState<number | null>(null)

  const handleToggle = async (month: number) => {
    if (!orgId || !user) return
    setToggling(month)
    try {
      const result = await allocationsService.togglePeriodLock(orgId, globalYear, month, user.id)
      toast({
        title: result.locked ? 'Period Locked' : 'Period Unlocked',
        description: `${MONTH_LABELS[month - 1]} ${globalYear} has been ${result.locked ? 'locked' : 'unlocked'}.`,
      })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle lock'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Period Locks — {globalYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1
            const locked = isLocked(month)
            return (
              <Button
                key={month}
                variant={locked ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'flex flex-col gap-0.5 h-auto py-2',
                  locked && 'bg-amber-500 hover:bg-amber-600 text-white',
                )}
                onClick={() => handleToggle(month)}
                disabled={toggling === month}
              >
                {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                <span className="text-xs">{label}</span>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
