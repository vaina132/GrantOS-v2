import { useNavigate } from 'react-router-dom'
import { Crown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface UpgradeBannerProps {
  message: string
  className?: string
  compact?: boolean
}

export function UpgradeBanner({ message, className, compact = false }: UpgradeBannerProps) {
  const navigate = useNavigate()

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300', className)}>
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{message}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
          onClick={() => navigate('/settings?tab=subscription')}
        >
          <Crown className="mr-1 h-3 w-3" /> Upgrade
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300', className)}>
      <Lock className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
        onClick={() => navigate('/settings?tab=subscription')}
      >
        <Crown className="mr-1 h-4 w-4" /> Upgrade to Pro
      </Button>
    </div>
  )
}
