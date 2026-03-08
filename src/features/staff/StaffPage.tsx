import { Routes, Route } from 'react-router-dom'
import { StaffList } from './StaffList'
import { StaffDetail } from './StaffDetail'
import { StaffForm } from './StaffForm'

export function StaffPage() {
  return (
    <Routes>
      <Route index element={<StaffList />} />
      <Route path="new" element={<StaffForm />} />
      <Route path=":id" element={<StaffDetail />} />
      <Route path=":id/edit" element={<StaffForm />} />
    </Routes>
  )
}
