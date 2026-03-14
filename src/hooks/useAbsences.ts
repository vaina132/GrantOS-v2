import { useState, useEffect, useCallback } from 'react'
import { absenceService, type AbsenceFilters } from '@/services/absenceService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/components/ui/use-toast'
import type { Absence } from '@/types'

export function useAbsences(filters?: Omit<AbsenceFilters, 'year'>) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [absences, setAbsences] = useState<Absence[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await absenceService.list(orgId, { ...filters, year: globalYear })
      setAbsences(data)
    } catch (err) {
      console.error('[useAbsences] load failed:', err)
      const message = err instanceof Error ? err.message : 'Failed to load absences'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear, filters?.person_id, filters?.type])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { absences, isLoading, refetch: fetch }
}
