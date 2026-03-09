import { useState } from 'react'
import { AbsenceList } from './AbsenceList'
import { AbsenceTimeline } from './AbsenceTimeline'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type View = 'timeline' | 'list'

export function AbsencesPage() {
  const [view, setView] = useState<View>('timeline')

  const tabs: { key: View; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'list', label: 'List View' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title="Absences"
        description="Track staff absences and leave"
      />

      <div className="border-b mt-4">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => {
            const active = view === t.key
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={cn(
                  'whitespace-nowrap pb-3 pt-1 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="pt-5 animate-fade-in" key={view}>
        {view === 'timeline' ? <AbsenceTimeline /> : <AbsenceList />}
      </div>
    </div>
  )
}
