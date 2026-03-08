import { useState, useEffect, useCallback } from 'react'
import { timesheetService, type TimesheetFilters } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/components/ui/use-toast'
import type { TimesheetEntry } from '@/types'

export function useTimesheets(filters?: Omit<TimesheetFilters, 'year'>) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await timesheetService.list(orgId, { ...filters, year: globalYear })
      setEntries(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load timesheets'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear, filters?.person_id, filters?.project_id, filters?.month, filters?.status])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { entries, isLoading, refetch: fetch }
}
