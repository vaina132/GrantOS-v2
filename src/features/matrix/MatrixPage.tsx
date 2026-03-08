import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { AssignmentMatrix } from './AssignmentMatrix'
import type { AssignmentType } from '@/types'

export function MatrixPage() {
  const [type, setType] = useState<AssignmentType>('actual')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment Matrix"
        description="Staff capacity planning heatmap — hover cells for project breakdown"
        actions={
          <div className="flex gap-2">
            <Button
              variant={type === 'actual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('actual')}
            >
              Actual
            </Button>
            <Button
              variant={type === 'official' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('official')}
            >
              Official
            </Button>
          </div>
        }
      />
      <AssignmentMatrix type={type} />
    </div>
  )
}
