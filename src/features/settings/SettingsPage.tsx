import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { OrgSettings } from './OrgSettings'
import { UsersSettings } from './UsersSettings'
import { FundingSchemes } from './FundingSchemes'
import { PeriodLocking } from '@/features/allocations/PeriodLocking'
import { HolidaySettings } from './HolidaySettings'
import { RolePermissions } from './RolePermissions'
import { AbsenceApprovers } from './AbsenceApprovers'

type SettingsTab = 'org' | 'users' | 'roles' | 'funding' | 'locks' | 'holidays' | 'approvers'

export function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<SettingsTab>('org')

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description="Organisation settings and configuration" />

      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'org', label: 'Organisation' },
          { key: 'users', label: 'Users' },
          { key: 'roles', label: 'Role Permissions' },
          { key: 'funding', label: 'Funding Schemes' },
          { key: 'locks', label: 'Period Locks' },
          { key: 'holidays', label: 'Holidays' },
          { key: 'approvers', label: 'Absence Approvers' },
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
      {tab === 'funding' && <FundingSchemes />}
      {tab === 'locks' && <PeriodLocking />}
      {tab === 'holidays' && <HolidaySettings />}
      {tab === 'approvers' && <AbsenceApprovers />}
    </div>
  )
}
