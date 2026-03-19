import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { YearSelector } from '@/components/common/YearSelector'
import { SavedReports } from './SavedReports'
import { ReportBuilder } from './ReportBuilder'
import { ReportsList as LegacyReports } from './ReportsList'
import type { ReportTemplate } from '@/types'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type View = 'list' | 'builder'

export function ReportsPage() {
  const [view, setView] = useState<View>('list')
  const [editTemplate, setEditTemplate] = useState<ReportTemplate | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [legacyOpen, setLegacyOpen] = useState(false)

  const handleNewReport = useCallback(() => {
    setEditTemplate(null)
    setView('builder')
  }, [])

  const handleEditReport = useCallback((t: ReportTemplate) => {
    setEditTemplate(t)
    setView('builder')
  }, [])

  const handleBuilderClose = useCallback(() => {
    setEditTemplate(null)
    setView('list')
  }, [])

  const handleSaved = useCallback(() => {
    setEditTemplate(null)
    setView('list')
    setRefreshTrigger(prev => prev + 1)
  }, [])

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <>
          <PageHeader
            title="Reports"
            description="Create, save, and share custom reports across your organisation"
            actions={<YearSelector />}
          />
          <SavedReports
            onNewReport={handleNewReport}
            onEditReport={handleEditReport}
            refreshTrigger={refreshTrigger}
          />

          {/* Legacy quick exports — collapsed by default */}
          <div className="border-t pt-4">
            <button
              onClick={() => setLegacyOpen(!legacyOpen)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', legacyOpen && 'rotate-180')} />
              Quick Exports
            </button>
            {legacyOpen && (
              <div className="mt-4">
                <LegacyReports />
              </div>
            )}
          </div>
        </>
      )}

      {view === 'builder' && (
        <ReportBuilder
          editTemplate={editTemplate}
          onClose={handleBuilderClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
