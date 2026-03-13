import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { GanttChart } from './GanttChart'

export function TimelinePage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.timeline')} description="Gantt-style visual overview of all projects" />
      <GanttChart />
    </div>
  )
}
