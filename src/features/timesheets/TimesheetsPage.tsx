import { PageHeader } from '@/components/layout/PageHeader'
import { TimesheetGrid } from './TimesheetGrid'

export function TimesheetsPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Timesheets"
        description="Record actual hours worked per project"
      />

      <div className="pt-5">
        <TimesheetGrid />
      </div>
    </div>
  )
}
