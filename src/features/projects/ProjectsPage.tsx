import { Routes, Route } from 'react-router-dom'
import { ProjectList } from './ProjectList'
import { ProjectDetail } from './ProjectDetail'
import { ProjectForm } from './ProjectForm'
import { GrantAIWizard } from './GrantAIWizard'
import { CollabProjectList } from './collaboration/CollabProjectList'
import { CollabProjectSetup } from './collaboration/CollabProjectSetup'
import { CollabProjectDetail } from './collaboration/CollabProjectDetail'
import { CollabReportPage } from './collaboration/CollabReportPage'

export function ProjectsPage() {
  return (
    <Routes>
      <Route index element={<ProjectList />} />
      <Route path="new" element={<ProjectForm />} />
      <Route path="import-ai" element={<GrantAIWizard />} />
      <Route path="collaboration" element={<CollabProjectList />} />
      <Route path="collaboration/new" element={<CollabProjectSetup mode="manual" />} />
      <Route path="collaboration/new/ai-import" element={<CollabProjectSetup mode="ai-import" />} />
      <Route path="collaboration/:id" element={<CollabProjectDetail />} />
      <Route path="collaboration/report/:reportId" element={<CollabReportPage />} />
      <Route path=":id" element={<ProjectDetail />} />
      <Route path=":id/edit" element={<ProjectForm />} />
    </Routes>
  )
}
