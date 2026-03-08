import { PageHeader } from '@/components/layout/PageHeader'
import { BudgetVsActuals } from './BudgetVsActuals'

export function FinancialsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Financials" description="Budget vs. actuals tracking per project" />
      <BudgetVsActuals />
    </div>
  )
}
