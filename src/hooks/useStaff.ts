import { useState, useEffect, useCallback } from 'react'
import { staffService, type StaffFilters } from '@/services/staffService'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/use-toast'
import type { Person } from '@/types'

export function useStaff(filters?: StaffFilters) {
  const { orgId } = useAuthStore()
  const [staff, setStaff] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await staffService.list(orgId, filters)
      setStaff(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load staff'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, filters?.search, filters?.department, filters?.employment_type, filters?.is_active])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { staff, isLoading, refetch: fetch }
}

export function useStaffMember(id: string | undefined) {
  const [person, setPerson] = useState<Person | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id) {
      setPerson(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const data = await staffService.getById(id)
      setPerson(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load staff member'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { person, isLoading, refetch: fetch }
}
