import { useState, useMemo } from 'react'
import { travelService } from '@/services/travelService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useTravels, useInvalidateTravels } from '@/hooks/useTravels'
import { YearSelector } from '@/components/common/YearSelector'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, Plane, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Travel } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function TravelTracker() {
  const { orgId, user, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })
  const { projects } = useProjects()
  const isAdmin = can('canManageProjects') || can('canApproveTimesheets')

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedPersonId, setSelectedPersonId] = useState('')

  // New travel form
  const [newDate, setNewDate] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const currentPersonId = selectedPersonId || staff.find(p => p.email === user?.email)?.id || ''

  const { travels, isLoading: loading, refetch: refetchTravels } = useTravels({ person_id: currentPersonId || undefined, month: selectedMonth })
  const invalidateTravels = useInvalidateTravels()

  const handleAdd = async () => {
    if (!orgId || !currentPersonId || !newDate || !newLocation.trim()) return
    setSaving(true)
    try {
      await travelService.create({
        org_id: orgId,
        person_id: currentPersonId,
        project_id: newProjectId || null,
        date: newDate,
        location: newLocation.trim(),
        notes: newNotes.trim() || null,
      })
      toast({ title: 'Travel added', description: `${newLocation.trim()} on ${new Date(newDate).toLocaleDateString()}` })
      setNewDate('')
      setNewProjectId('')
      setNewLocation('')
      setNewNotes('')
      refetchTravels()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add travel'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (travel: Travel) => {
    try {
      await travelService.remove(travel.id)
      toast({ title: 'Travel removed' })
      refetchTravels()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove travel'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  // Group travels by date
  const groupedTravels = useMemo(() => {
    const map = new Map<string, Travel[]>()
    for (const t of travels) {
      const key = t.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [travels])

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        {isAdmin && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Person</label>
            <select
              value={currentPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All staff</option>
              {staff.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <YearSelector />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5 flex-wrap">
              {MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMonth(i + 1)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                    selectedMonth === i + 1
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">{MONTHS[selectedMonth - 1]} {globalYear} — Travels</span>
        </div>
        <span className="text-xs text-muted-foreground">{travels.length} travel{travels.length !== 1 ? 's' : ''} recorded</span>
      </div>

      {/* Add travel form */}
      {currentPersonId && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold">Add Travel</h4>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1 min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <Input
                placeholder="City / destination"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground">Project (optional)</label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.acronym} — {p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Input
                placeholder="Purpose of travel"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button onClick={handleAdd} disabled={saving || !newDate || !newLocation.trim()} className="gap-1.5 h-9">
              <Plus className="h-4 w-4" />
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {/* Travel list */}
      {loading ? (
        <SkeletonTable columns={5} rows={4} />
      ) : travels.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No travels recorded"
          description={`No travel entries found for ${MONTHS[selectedMonth - 1]} ${globalYear}. Use the form above to add travel days.`}
        />
      ) : (
        <div className="space-y-3">
          {groupedTravels.map(([dateStr, dayTravels]) => {
            const date = new Date(dateStr + 'T00:00:00')
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
            const dateFormatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

            return (
              <div key={dateStr} className="rounded-lg border overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 border-b px-4 py-2 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{dayName}, {dateFormatted}</span>
                  <span className="text-[10px] text-orange-600/60 dark:text-orange-400/50">({dayTravels.length} travel{dayTravels.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="divide-y">
                  {dayTravels.map(travel => (
                    <div key={travel.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {isAdmin && travel.persons && (
                          <PersonAvatar name={travel.persons.full_name} size="sm" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{travel.location}</span>
                            {travel.projects && (
                              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                                {travel.projects.acronym}
                              </span>
                            )}
                          </div>
                          {travel.notes && (
                            <div className="text-[11px] text-muted-foreground truncate">{travel.notes}</div>
                          )}
                          {isAdmin && travel.persons && (
                            <div className="text-[10px] text-muted-foreground">{travel.persons.full_name}</div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => handleRemove(travel)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
