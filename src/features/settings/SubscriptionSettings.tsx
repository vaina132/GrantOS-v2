import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { settingsService } from '@/services/settingsService'
import { aiUsageService } from '@/services/aiUsageService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  Building2,
  AlertTriangle,
  ExternalLink,
  CreditCard,
  CalendarClock,
  ArrowRight,
  Shield,
  Users,
  FolderKanban,
  Bot,
  FileText,
  Globe,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { differenceInDays, format } from 'date-fns'
import type { OrgPlan, AiUsage } from '@/types'
import { AI_PLAN_LIMITS } from '@/types'

// ── Plan definitions ─────────────────────────────────────

interface PlanDef {
  id: OrgPlan
  name: string
  price: string
  period: string
  description: string
  icon: typeof Crown
  color: string
  bgColor: string
  borderColor: string
  features: string[]
  limits: { projects: string; staff: string; users: string; ai: string; extras: string[] }
  paddlePriceId?: string // Will be set once Paddle is integrated
  highlighted?: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: '0',
    period: '14 days',
    description: 'See if GrantLume fits your team',
    icon: Sparkles,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    features: [
      'All features included',
      '3 projects',
      '5 staff members',
      '2 user seats',
      '5 AI document parses',
    ],
    limits: {
      projects: '3',
      staff: '5',
      users: '2',
      ai: '10 requests / 200K tokens',
      extras: [],
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '49',
    period: '/mo',
    description: 'For small research groups',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    features: [
      '10 projects',
      '20 staff members',
      '5 user seats',
      '20 AI parses/month',
      'PDF reports & export',
    ],
    limits: {
      projects: '10',
      staff: '20',
      users: '5',
      ai: '30 requests / 500K tokens',
      extras: ['PDF reports & export'],
    },
    paddlePriceId: '', // TODO: Set Paddle price ID
    highlighted: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '99',
    period: '/mo',
    description: 'For departments with partners',
    icon: Crown,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    features: [
      'Unlimited projects',
      'Unlimited staff',
      '20 user seats',
      '100 AI parses/month',
      'Collaboration module',
      'Custom role permissions',
    ],
    limits: {
      projects: 'Unlimited',
      staff: 'Unlimited',
      users: '20',
      ai: '100 requests / 2M tokens',
      extras: ['Collaboration module', 'Custom role permissions'],
    },
    paddlePriceId: '', // TODO: Set Paddle price ID
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large institutions',
    icon: Building2,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    features: [
      'Everything in Growth',
      'Unlimited user seats',
      '500 AI parses/month',
      'Priority support',
      'SSO integration',
      'Custom onboarding',
    ],
    limits: {
      projects: 'Unlimited',
      staff: 'Unlimited',
      users: 'Unlimited',
      ai: '500 requests / 10M tokens',
      extras: ['Priority support', 'SSO', 'Custom onboarding'],
    },
  },
]

const PLAN_ORDER: OrgPlan[] = ['trial', 'starter', 'growth', 'enterprise']

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Component ────────────────────────────────────────────

export function SubscriptionSettings() {
  const { t } = useTranslation()
  const { orgId, orgPlan, trialEndsAt } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<OrgPlan>('trial')
  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [paddleCustomerId, setPaddleCustomerId] = useState<string | null>(null)
  const [paddleSubscriptionId, setPaddleSubscriptionId] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [upgrading, setUpgrading] = useState<OrgPlan | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [org, usage] = await Promise.all([
        settingsService.getOrganisation(orgId),
        aiUsageService.getCurrentUsage(orgId),
      ])
      if (org) {
        setCurrentPlan((org.plan as OrgPlan) || 'trial')
        setTrialEnd(org.trial_ends_at)
        setPaddleCustomerId((org as any).paddle_customer_id ?? null)
        setPaddleSubscriptionId((org as any).paddle_subscription_id ?? null)
        setSubscriptionStatus((org as any).subscription_status ?? null)
      }
      setAiUsage(usage)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  // Trial days remaining
  const trialDaysLeft = currentPlan === 'trial' && (trialEnd || trialEndsAt)
    ? Math.max(0, differenceInDays(new Date(trialEnd || trialEndsAt!), new Date()))
    : null

  const trialExpired = trialDaysLeft !== null && trialDaysLeft <= 0

  // Current plan index for comparison
  const currentPlanIdx = PLAN_ORDER.indexOf(currentPlan)

  // AI usage stats
  const limits = AI_PLAN_LIMITS[currentPlan]
  const tokensUsed = aiUsage ? (aiUsage.tokens_in + aiUsage.tokens_out) : 0
  const requestsUsed = aiUsage?.request_count ?? 0
  const tokenPct = limits.monthly_tokens > 0 ? Math.min(100, (tokensUsed / limits.monthly_tokens) * 100) : 0
  const requestPct = limits.monthly_requests > 0 ? Math.min(100, (requestsUsed / limits.monthly_requests) * 100) : 0

  // Handle upgrade click
  const handleUpgrade = async (targetPlan: OrgPlan) => {
    if (targetPlan === 'enterprise') {
      window.location.href = 'mailto:hello@grantlume.com?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    setUpgrading(targetPlan)

    // Check if Paddle.js is loaded and price IDs are set
    const planDef = PLANS.find(p => p.id === targetPlan)
    if (!planDef?.paddlePriceId) {
      // Paddle not yet configured — show a helpful message
      toast({
        title: t('subscription.upgradeComingSoon'),
        description: t('subscription.upgradeComingSoonDesc'),
      })
      setUpgrading(null)
      return
    }

    try {
      // Open Paddle checkout overlay
      const Paddle = (window as any).Paddle
      if (!Paddle) {
        toast({
          title: t('subscription.paymentUnavailable'),
          description: t('subscription.paymentUnavailableDesc'),
          variant: 'destructive',
        })
        setUpgrading(null)
        return
      }

      Paddle.Checkout.open({
        items: [{ priceId: planDef.paddlePriceId, quantity: 1 }],
        customData: { org_id: orgId },
        customer: paddleCustomerId ? { id: paddleCustomerId } : undefined,
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: 'en',
          successUrl: `${window.location.origin}/settings?tab=subscription&upgraded=true`,
        },
      })
    } catch (err) {
      console.error('Paddle checkout error:', err)
      toast({
        title: t('common.error'),
        description: t('subscription.checkoutFailed'),
        variant: 'destructive',
      })
    } finally {
      setUpgrading(null)
    }
  }

  // Handle manage subscription (Paddle customer portal)
  const handleManageSubscription = () => {
    // For now link to Paddle customer portal if subscription exists
    if (paddleSubscriptionId) {
      const Paddle = (window as any).Paddle
      if (Paddle) {
        try {
          Paddle.Checkout.open({
            transactionId: paddleSubscriptionId,
            settings: { displayMode: 'overlay' },
          })
          return
        } catch { /* fallthrough */ }
      }
    }
    toast({
      title: t('subscription.manageSubscription'),
      description: t('subscription.manageSubscriptionDesc'),
    })
  }

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      {/* ── Current Plan Summary ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4.5 w-4.5" />
                {t('subscription.currentPlan')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('subscription.currentPlanDesc')}
              </CardDescription>
            </div>
            {subscriptionStatus === 'active' && paddleSubscriptionId && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                {t('subscription.manageSubscription')}
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Plan badge */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-14 w-14 items-center justify-center rounded-xl',
                PLANS.find(p => p.id === currentPlan)?.bgColor ?? 'bg-muted',
              )}>
                {(() => {
                  const Icon = PLANS.find(p => p.id === currentPlan)?.icon ?? Sparkles
                  const color = PLANS.find(p => p.id === currentPlan)?.color ?? 'text-muted-foreground'
                  return <Icon className={cn('h-7 w-7', color)} />
                })()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">
                    {PLANS.find(p => p.id === currentPlan)?.name ?? currentPlan}
                  </h3>
                  <Badge variant={currentPlan === 'trial' ? 'secondary' : 'default'} className="text-xs">
                    {subscriptionStatus === 'active' ? t('subscription.active') :
                     subscriptionStatus === 'past_due' ? t('subscription.pastDue') :
                     currentPlan === 'trial' ? t('subscription.trial') :
                     t('subscription.active')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentPlan === 'trial' && trialDaysLeft !== null ? (
                    trialExpired
                      ? <span className="text-destructive font-medium">{t('subscription.trialExpired')}</span>
                      : <span>{t('subscription.trialDaysLeft', { count: trialDaysLeft })}</span>
                  ) : currentPlan !== 'trial' ? (
                    <>
                      <span className="font-semibold">{PLANS.find(p => p.id === currentPlan)?.price}€</span>
                      <span>{PLANS.find(p => p.id === currentPlan)?.period}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Trial warning */}
            {currentPlan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 7 && (
              <div className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 flex-1',
                trialExpired
                  ? 'bg-destructive/10 border border-destructive/20'
                  : 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
              )}>
                <AlertTriangle className={cn(
                  'h-5 w-5 shrink-0',
                  trialExpired ? 'text-destructive' : 'text-amber-600',
                )} />
                <div className="text-sm">
                  <p className={cn('font-medium', trialExpired ? 'text-destructive' : 'text-amber-800 dark:text-amber-200')}>
                    {trialExpired ? t('subscription.trialExpiredTitle') : t('subscription.trialExpiringTitle')}
                  </p>
                  <p className={cn('mt-0.5', trialExpired ? 'text-destructive/80' : 'text-amber-700 dark:text-amber-300')}>
                    {trialExpired
                      ? t('subscription.trialExpiredDesc')
                      : t('subscription.trialExpiringDesc', { count: trialDaysLeft })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* AI Usage summary */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-muted-foreground" />
              {t('subscription.aiUsageThisMonth')}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('ai.tokens')}</span>
                  <span>{formatTokens(tokensUsed)} / {formatTokens(limits.monthly_tokens)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      tokenPct >= 100 ? 'bg-destructive' : tokenPct >= 80 ? 'bg-amber-500' : 'bg-primary',
                    )}
                    style={{ width: `${tokenPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('ai.requests')}</span>
                  <span>{requestsUsed} / {limits.monthly_requests}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      requestPct >= 100 ? 'bg-destructive' : requestPct >= 80 ? 'bg-amber-500' : 'bg-primary',
                    )}
                    style={{ width: `${requestPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Plan Comparison Cards ── */}
      <div>
        <h3 className="text-base font-semibold mb-4">{t('subscription.comparePlans')}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan
            const planIdx = PLAN_ORDER.indexOf(plan.id)
            const isUpgrade = planIdx > currentPlanIdx
            const isDowngrade = planIdx < currentPlanIdx
            const PlanIcon = plan.icon

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col transition-shadow',
                  isCurrent && 'ring-2 ring-primary shadow-md',
                  plan.highlighted && !isCurrent && 'ring-1 ring-blue-300',
                )}
              >
                {plan.highlighted && !isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5">{t('subscription.popular')}</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">{t('subscription.currentBadge')}</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('rounded-lg p-1.5', plan.bgColor)}>
                      <PlanIcon className={cn('h-4 w-4', plan.color)} />
                    </div>
                    <CardTitle className="text-sm">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                  <div className="mt-2">
                    {plan.price === 'Custom' ? (
                      <span className="text-2xl font-bold">{t('subscription.custom')}</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">{plan.price}€</span>
                        {plan.period && <span className="text-sm text-muted-foreground ml-0.5">{plan.period}</span>}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="px-6 pb-5">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      {t('subscription.currentPlanBtn')}
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading !== null}
                    >
                      {upgrading === plan.id ? (
                        t('subscription.processing')
                      ) : (
                        <>
                          {t('subscription.upgrade')} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  ) : isDowngrade ? (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled>
                      {t('subscription.downgrade')}
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Feature Comparison Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('subscription.featureComparison')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('subscription.feature')}</th>
                  {PLANS.map(p => (
                    <th key={p.id} className={cn(
                      'px-4 py-2.5 text-center font-medium',
                      p.id === currentPlan && 'bg-primary/5',
                    )}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { icon: FolderKanban, label: t('subscription.limitProjects'), values: PLANS.map(p => p.limits.projects) },
                  { icon: Users, label: t('subscription.limitStaff'), values: PLANS.map(p => p.limits.staff) },
                  { icon: Users, label: t('subscription.limitUsers'), values: PLANS.map(p => p.limits.users) },
                  { icon: Bot, label: t('subscription.limitAi'), values: PLANS.map(p => p.limits.ai) },
                  { icon: FileText, label: t('subscription.limitReports'), values: ['Basic', 'Full', 'Full', 'Full'] },
                  { icon: Globe, label: t('subscription.limitCollab'), values: ['—', '—', '✓', '✓'] },
                  { icon: Lock, label: t('subscription.limitRoles'), values: ['Default', 'Default', 'Custom', 'Custom'] },
                  { icon: Shield, label: t('subscription.limitSupport'), values: ['Community', 'Email', 'Priority', 'Dedicated'] },
                ].map((row, i) => {
                  const RowIcon = row.icon
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <RowIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{row.label}</span>
                      </td>
                      {row.values.map((v, j) => (
                        <td key={j} className={cn(
                          'px-4 py-2.5 text-center text-xs',
                          PLANS[j].id === currentPlan && 'bg-primary/5 font-medium',
                        )}>
                          {v === '✓' ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : v}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── FAQ / Info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('subscription.billingFaq')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{t('subscription.faqUpgrade')}</p>
            <p>{t('subscription.faqUpgradeAnswer')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('subscription.faqDowngrade')}</p>
            <p>{t('subscription.faqDowngradeAnswer')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('subscription.faqCancel')}</p>
            <p>{t('subscription.faqCancelAnswer')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('subscription.faqData')}</p>
            <p>{t('subscription.faqDataAnswer')}</p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs">
              {t('subscription.paymentNote')}{' '}
              <a href="mailto:hello@grantlume.com" className="text-primary hover:underline font-medium">
                hello@grantlume.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
