import { useState } from 'react'
import { AbsenceList } from './AbsenceList'
import { AbsenceTimeline } from './AbsenceTimeline'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { CalendarDays, List } from 'lucide-react'
import { cn } from '@/lib/utils'

type View = 'timeline' | 'list'

export function AbsencesPage() {
  const [view, setView] = useState<View>('timeline')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absences"
        description="Track staff absences and leave"
        actions={
          <div className="flex gap-1 rounded-md border p-0.5">
            <Button
              variant={view === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('timeline')}
              className={cn('gap-1.5', view !== 'timeline' && 'text-muted-foreground')}
            >
              <CalendarDays className="h-4 w-4" /> Timeline
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={cn('gap-1.5', view !== 'list' && 'text-muted-foreground')}
            >
              <List className="h-4 w-4" /> List
            </Button>
          </div>
        }
      />
      {view === 'timeline' ? <AbsenceTimeline /> : <AbsenceList />}
    </div>
  )
}
