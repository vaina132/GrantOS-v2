import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { OrgSettings } from './OrgSettings'
import { UsersSettings } from './UsersSettings'
import { FundingSchemes } from './FundingSchemes'
import { PeriodLocking } from '@/features/allocations/PeriodLocking'
import { HolidaySettings } from './HolidaySettings'
import { RolePermissions } from './RolePermissions'
import { AbsenceApprovers } from './AbsenceApprovers'
import { AbsenceTypeSettings } from './AbsenceTypeSettings'
import { IntegrationsSettings } from './IntegrationsSettings'
import { TimesheetApprovers } from './TimesheetApprovers'
import { SubscriptionSettings } from './SubscriptionSettings'
import { SecuritySettings } from './SecuritySettings'

type SettingsTab = 'org' | 'users' | 'roles' | 'security' | 'funding' | 'locks' | 'holidays' | 'approvers' | 'ts-approvers' | 'absence-types' | 'integrations' | 'subscription'

const VALID_TABS: SettingsTab[] = ['org', 'users', 'roles', 'security', 'funding', 'locks', 'holidays', 'approvers', 'ts-approvers', 'absence-types', 'integrations', 'subscription']

export function SettingsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'org'
  const [tab, setTab] = useState<SettingsTab>(VALID_TABS.includes(initialTab) ? initialTab : 'org')

  // Sync tab if URL changes (e.g. notification link)
  useEffect(() => {
    const urlTab = searchParams.get('tab') as SettingsTab
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== tab) {
      setTab(urlTab)
    }
  }, [searchParams])

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description="Organisation settings and configuration" />

      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'org', label: 'Organisation' },
          { key: 'users', label: 'Users' },
          { key: 'roles', label: 'Role Permissions' },
          { key: 'security', label: 'Security' },
          { key: 'funding', label: 'Funding Schemes' },
          { key: 'locks', label: 'Period Locks' },
          { key: 'holidays', label: 'Holidays' },
          { key: 'approvers', label: 'Absence Approvers' },
          { key: 'ts-approvers', label: 'Timesheet Approvers' },
          { key: 'absence-types', label: 'Absence Types' },
          { key: 'integrations', label: 'Integrations' },
          { key: 'subscription', label: 'Subscription' },
        ] as { key: SettingsTab; label: string }[]).map((item) => (
          <Button
            key={item.key}
            variant={tab === item.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'org' && <OrgSettings />}
      {tab === 'users' && <UsersSettings />}
      {tab === 'roles' && <RolePermissions />}
      {tab === 'security' && <SecuritySettings />}
      {tab === 'funding' && <FundingSchemes />}
      {tab === 'locks' && <PeriodLocking />}
      {tab === 'holidays' && <HolidaySettings />}
      {tab === 'approvers' && <AbsenceApprovers />}
      {tab === 'ts-approvers' && <TimesheetApprovers />}
      {tab === 'absence-types' && <AbsenceTypeSettings />}
      {tab === 'integrations' && <IntegrationsSettings />}
      {tab === 'subscription' && <SubscriptionSettings />}
    </div>
  )
}
