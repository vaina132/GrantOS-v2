import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { OrgSettings } from './OrgSettings'
import { UsersSettings } from './UsersSettings'
import { FundingSchemes } from './FundingSchemes'
import { PeriodLocking } from '@/features/allocations/PeriodLocking'

type SettingsTab = 'org' | 'users' | 'funding' | 'locks'

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('org')

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organisation settings and configuration" />

      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'org', label: 'Organisation' },
          { key: 'users', label: 'Users' },
          { key: 'funding', label: 'Funding Schemes' },
          { key: 'locks', label: 'Period Locks' },
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
      {tab === 'funding' && <FundingSchemes />}
      {tab === 'locks' && <PeriodLocking />}
    </div>
  )
}
