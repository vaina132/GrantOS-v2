import { Routes, Route } from 'react-router-dom'
import { ProjectList } from './ProjectList'
import { ProjectDetail } from './ProjectDetail'
import { ProjectForm } from './ProjectForm'
import { GrantAIWizard } from './GrantAIWizard'

export function ProjectsPage() {
  return (
    <Routes>
      <Route index element={<ProjectList />} />
      <Route path="new" element={<ProjectForm />} />
      <Route path="import-ai" element={<GrantAIWizard />} />
      <Route path=":id" element={<ProjectDetail />} />
      <Route path=":id/edit" element={<ProjectForm />} />
    </Routes>
  )
}
