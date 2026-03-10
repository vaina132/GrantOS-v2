import { PageHeader } from '@/components/layout/PageHeader'
import { AssignmentMatrix } from './AssignmentMatrix'

export function MatrixPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment Matrix"
        description="Staff capacity planning heatmap — hover cells for project breakdown"
      />
      <AssignmentMatrix />
    </div>
  )
}
