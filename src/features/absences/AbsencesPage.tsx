import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AbsenceList } from './AbsenceList'
import { AbsenceTimeline } from './AbsenceTimeline'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type View = 'timeline' | 'list'

export function AbsencesPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('timeline')

  const tabs: { key: View; label: string }[] = [
    { key: 'timeline', label: t('absences.timeline') },
    { key: 'list', label: t('absences.listView') },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title={t('absences.title')}
        description={t('absences.description')}
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
