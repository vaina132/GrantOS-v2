import { Routes, Route } from 'react-router-dom'
import { CollabProjectList } from './CollabProjectList'
import { CollabProjectSetup } from './CollabProjectSetup'
import { CollabProjectDetail } from './CollabProjectDetail'
import { CollabReportPage } from './CollabReportPage'

export function CollabPages() {
  return (
    <Routes>
      <Route index element={<CollabProjectList />} />
      <Route path="new" element={<CollabProjectSetup mode="manual" />} />
      <Route path="new/ai-import" element={<CollabProjectSetup mode="ai-import" />} />
      <Route path=":id" element={<CollabProjectDetail />} />
      <Route path=":id/edit" element={<CollabProjectSetup mode="manual" />} />
      <Route path="report/:reportId" element={<CollabReportPage />} />
    </Routes>
  )
}
