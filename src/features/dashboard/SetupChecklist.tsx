import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { useStaff } from '@/hooks/useStaff'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  Circle,
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  Settings,
  ChevronRight,
  X,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISSED_KEY = 'grantlume_setup_checklist_dismissed'

interface ChecklistStep {
  id: string
  label: string
  description: string
  icon: typeof FolderKanban
  href: string
  completed: boolean
}

export function SetupChecklist() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { orgId, orgName } = useAuthStore()
  const { projects } = useProjects()
  const { staff } = useStaff({})

  // Year-independent existence checks for allocations & timesheets
  const [hasAllocations, setHasAllocations] = useState(false)
  const [hasTimesheets, setHasTimesheets] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    // Check if ANY assignment exists for this org (across all years)
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('type', 'actual')
      .limit(1)
      .then(({ count }) => { if (!cancelled) setHasAllocations((count ?? 0) > 0) })
    // Check if ANY timesheet_days entry exists for this org
    ;(supabase as any)
      .from('timesheet_days')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gt('hours', 0)
      .limit(1)
      .then(({ count }: { count: number | null }) => { if (!cancelled) setHasTimesheets((count ?? 0) > 0) })
    return () => { cancelled = true }
  }, [orgId])

  const [dismissed, setDismissed] = useState(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY)
      if (!stored || !orgId) return false
      const parsed = JSON.parse(stored) as Record<string, boolean>
      return parsed[orgId] === true
    } catch { return false }
  })

  // Re-check dismissal when orgId changes
  useEffect(() => {
    if (!orgId) return
    try {
      const stored = localStorage.getItem(DISMISSED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>
        setDismissed(parsed[orgId] === true)
      } else {
        setDismissed(false)
      }
    } catch { setDismissed(false) }
  }, [orgId])

  const steps: ChecklistStep[] = useMemo(() => [
    {
      id: 'org',
      label: t('onboarding.stepOrg'),
      description: t('onboarding.stepOrgDesc'),
      icon: Settings,
      href: '/settings',
      completed: !!orgName && orgName.length > 0,
    },
    {
      id: 'staff',
      label: t('onboarding.stepStaff'),
      description: t('onboarding.stepStaffDesc'),
      icon: Users,
      href: '/staff',
      completed: staff.length > 0,
    },
    {
      id: 'project',
      label: t('onboarding.stepProject'),
      description: t('onboarding.stepProjectDesc'),
      icon: FolderKanban,
      href: '/projects',
      completed: projects.length > 0,
    },
    {
      id: 'allocations',
      label: t('onboarding.stepAllocations'),
      description: t('onboarding.stepAllocationsDesc'),
      icon: CalendarDays,
      href: '/allocations',
      completed: hasAllocations,
    },
    {
      id: 'timesheets',
      label: t('onboarding.stepTimesheets'),
      description: t('onboarding.stepTimesheetsDesc'),
      icon: ClipboardCheck,
      href: '/timesheets',
      completed: hasTimesheets,
    },
  ], [orgName, staff.length, projects.length, hasAllocations, hasTimesheets, t])

  const completedCount = steps.filter((s) => s.completed).length
  const allDone = completedCount === steps.length
  const progress = Math.round((completedCount / steps.length) * 100)

  const handleDismiss = () => {
    if (!orgId) return
    setDismissed(true)
    try {
      const stored = localStorage.getItem(DISMISSED_KEY)
      const parsed = stored ? JSON.parse(stored) : {}
      parsed[orgId] = true
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(parsed))
    } catch { /* ignore */ }
  }

  if (dismissed) return null

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('onboarding.checklistTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allDone ? t('onboarding.allDone') : t('onboarding.checklistSubtitle', { completed: completedCount, total: steps.length })}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDismiss} title={t('common.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="space-y-1">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => navigate(step.href)}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                step.completed && 'opacity-70',
              )}
            >
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className={cn('text-sm font-medium', step.completed && 'line-through text-muted-foreground')}>
                  {step.label}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{step.description}</div>
              </div>
              {!step.completed && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
