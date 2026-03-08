import { PageHeader } from '@/components/layout/PageHeader'
import { GanttChart } from './GanttChart'

export function TimelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Project Timeline" description="Gantt-style visual overview of all projects" />
      <GanttChart />
    </div>
  )
}
