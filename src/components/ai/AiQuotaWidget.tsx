import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { aiUsageService } from '@/services/aiUsageService'
import { AI_PLAN_LIMITS } from '@/types'
import type { OrgPlan } from '@/types'
import { Sparkles, TrendingUp, AlertTriangle, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiQuotaWidgetProps {
  /** Compact = inline bar only; full = bar + details */
  variant?: 'compact' | 'full'
  className?: string
  /** Called with true when quota is exhausted */
  onQuotaExhausted?: (exhausted: boolean) => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function planLabel(plan: OrgPlan): string {
  const map: Record<OrgPlan, string> = {
    trial: 'Free Trial',
    pro: 'Pro',
  }
  return map[plan] || plan
}

export function AiQuotaWidget({ variant = 'full', className, onQuotaExhausted }: AiQuotaWidgetProps) {
  const { t } = useTranslation()
  const { orgId, orgPlan } = useAuthStore()
  const plan = orgPlan || 'trial'
  const limits = AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.trial

  const [tokensUsed, setTokensUsed] = useState(0)
  const [requestsUsed, setRequestsUsed] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    aiUsageService.getCurrentUsage(orgId).then((usage) => {
      const tIn = usage?.tokens_in || 0
      const tOut = usage?.tokens_out || 0
      const reqs = usage?.request_count || 0
      setTokensUsed(tIn + tOut)
      setRequestsUsed(reqs)
      onQuotaExhausted?.(tIn + tOut >= limits.monthly_tokens || reqs >= limits.monthly_requests)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [orgId, limits.monthly_tokens, limits.monthly_requests, onQuotaExhausted])

  const tokenPct = Math.min((tokensUsed / limits.monthly_tokens) * 100, 100)
  const requestPct = Math.min((requestsUsed / limits.monthly_requests) * 100, 100)
  const tokensRemaining = Math.max(limits.monthly_tokens - tokensUsed, 0)
  const requestsRemaining = Math.max(limits.monthly_requests - requestsUsed, 0)
  const isExhausted = tokensRemaining === 0 || requestsRemaining === 0
  const isWarning = tokenPct >= 80 || requestPct >= 80

  // Color based on usage level
  const barColor = isExhausted
    ? 'bg-red-500'
    : isWarning
      ? 'bg-amber-500'
      : 'bg-emerald-500'

  const iconColor = isExhausted
    ? 'text-red-500'
    : isWarning
      ? 'text-amber-500'
      : 'text-emerald-500'

  if (loading) {
    return (
      <div className={cn('animate-pulse rounded-lg border bg-muted/30 p-3 h-[60px]', className)} />
    )
  }

  const remainingPct = Math.max(0, Math.round(100 - Math.max(tokenPct, requestPct)))

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <Sparkles className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-[80px]">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${tokenPct}%` }} />
          </div>
        </div>
        <span className={cn('whitespace-nowrap font-medium', isExhausted ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground')}>
          {remainingPct}% {t('ai.creditsLeft')}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', isExhausted ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' : 'bg-muted/30', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isExhausted ? (
            <Ban className="h-4 w-4 text-red-500" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-sm font-medium">{t('ai.quota')}</span>
        </div>
        <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {planLabel(plan)}
        </span>
      </div>

      {/* Token bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('ai.tokens')}</span>
          <span className={cn('font-medium', isExhausted ? 'text-red-600 dark:text-red-400' : '')}>
            {Math.round(tokenPct)}% used
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${tokenPct}%` }} />
        </div>
        <div className="text-[10px] text-muted-foreground">
          {formatTokens(tokensRemaining)} of {formatTokens(limits.monthly_tokens)} remaining
        </div>
      </div>

      {/* Request count */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('ai.requests')}</span>
          <span className={cn('font-medium', isExhausted ? 'text-red-600 dark:text-red-400' : '')}>
            {Math.round(requestPct)}% used
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', requestPct >= 100 ? 'bg-red-500' : requestPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${requestPct}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground">
          {requestsRemaining} of {limits.monthly_requests} requests remaining
        </div>
      </div>

      {/* Footer message */}
      {isExhausted ? (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <Ban className="h-3 w-3 shrink-0" />
          {t('ai.quotaExhausted')}
        </p>
      ) : isWarning ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t('ai.quotaWarning', { remaining: `${remainingPct}%` })}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 shrink-0" />
          {remainingPct}% of your AI credits remaining this month
        </p>
      )}
    </div>
  )
}
