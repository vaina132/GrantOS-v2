import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { OrgSettings } from './OrgSettings'
import { UsersSettings } from './UsersSettings'
import { FundingSchemes } from './FundingSchemes'
import { PeriodLocking } from '@/features/allocations/PeriodLocking'
import { HolidaySettings } from './HolidaySettings'
import { RolePermissions } from './RolePermissions'

type SettingsTab = 'org' | 'users' | 'roles' | 'funding' | 'locks' | 'holidays'

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('org')

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organisation settings and configuration" />

      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'org', label: 'Organisation' },
          { key: 'users', label: 'Users' },
          { key: 'roles', label: 'Role Permissions' },
          { key: 'funding', label: 'Funding Schemes' },
          { key: 'locks', label: 'Period Locks' },
          { key: 'holidays', label: 'Holidays' },
        ] as { key: SettingsTab; label: string }[]).map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'org' && <OrgSettings />}
      {tab === 'users' && <UsersSettings />}
      {tab === 'roles' && <RolePermissions />}
      {tab === 'funding' && <FundingSchemes />}
      {tab === 'locks' && <PeriodLocking />}
      {tab === 'holidays' && <HolidaySettings />}
    </div>
  )
}
