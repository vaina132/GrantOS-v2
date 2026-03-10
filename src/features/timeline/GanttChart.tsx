import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { useAuthStore } from '@/stores/authStore'
import { deliverablesService } from '@/services/deliverablesService'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { GanttChart as GanttIcon, ZoomIn, ZoomOut, RotateCcw, CalendarDays, FileText, Target, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseISO, differenceInMonths, startOfMonth, addMonths, format, isBefore, isAfter } from 'date-fns'
import type { Deliverable, Milestone, ReportingPeriod } from '@/types'

const ZOOM_LEVELS = [20, 30, 40, 60, 80, 110, 150]
const DEFAULT_ZOOM_INDEX = 3 // 60px

interface BarData {
  projectId: string
  acronym: string
  title: string
  status: string
  startDate: Date
  endDate: Date
}

export function GanttChart() {
  const { projects, isLoading } = useProjects()
  const { orgId } = useAuthStore()
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Overlay visibility toggles
  const [showDeliverables, setShowDeliverables] = useState(true)
  const [showMilestones, setShowMilestones] = useState(true)
  const [showReporting, setShowReporting] = useState(false)

  // Overlay data keyed by project ID
  const [deliverablesByProject, setDeliverablesByProject] = useState<Record<string, Deliverable[]>>({})
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, Milestone[]>>({})
  const [reportingByProject, setReportingByProject] = useState<Record<string, ReportingPeriod[]>>({})

  // Fetch overlay data for all projects
  useEffect(() => {
    if (!orgId || projects.length === 0) return
    let cancelled = false

    const load = async () => {
      const delMap: Record<string, Deliverable[]> = {}
      const msMap: Record<string, Milestone[]> = {}
      const rpMap: Record<string, ReportingPeriod[]> = {}

      await Promise.all(projects.map(async (p) => {
        try {
          const [dels, mss, rps] = await Promise.all([
            deliverablesService.listDeliverables(p.id),
            deliverablesService.listMilestones(p.id),
            deliverablesService.listReportingPeriods(p.id),
          ])
          delMap[p.id] = dels
          msMap[p.id] = mss
          rpMap[p.id] = rps
        } catch {
          // silently ignore per-project errors
        }
      }))

      if (!cancelled) {
        setDeliverablesByProject(delMap)
        setMilestonesByProject(msMap)
        setReportingByProject(rpMap)
      }
    }

    load()
    return () => { cancelled = true }
  }, [orgId, projects])

  const colWidth = ZOOM_LEVELS[zoomIndex]

  const handleZoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }, [])

  const { bars, monthHeaders, timelineStart } = useMemo(() => {
    if (projects.length === 0) return { bars: [], monthHeaders: [], timelineStart: new Date() }

    const parsed: BarData[] = projects.map((p) => ({
      projectId: p.id,
      acronym: p.acronym,
      title: p.title,
      status: p.status,
      startDate: parseISO(p.start_date),
      endDate: parseISO(p.end_date),
    }))

    // Find global min/max dates
    let minDate = parsed[0].startDate
    let maxDate = parsed[0].endDate
    for (const b of parsed) {
      if (isBefore(b.startDate, minDate)) minDate = b.startDate
      if (isAfter(b.endDate, maxDate)) maxDate = b.endDate
    }

    const tStart = startOfMonth(minDate)
    const totalMonths = differenceInMonths(maxDate, tStart) + 2

    const headers: { label: string; date: Date }[] = []
    for (let i = 0; i < totalMonths; i++) {
      const d = addMonths(tStart, i)
      headers.push({ label: format(d, 'MMM yy'), date: d })
    }

    return { bars: parsed, monthHeaders: headers, timelineStart: tStart }
  }, [projects])

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return
    const today = new Date()
    const monthsFromStart = differenceInMonths(today, timelineStart)
    const scrollLeft = Math.max(0, monthsFromStart * colWidth - scrollRef.current.clientWidth / 2)
    scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [timelineStart, colWidth])

  if (isLoading) return <SkeletonTable columns={6} rows={6} />

  if (bars.length === 0) {
    return (
      <EmptyState
        icon={GanttIcon}
        title="No projects to display"
        description="Create projects with start and end dates to see the Gantt chart."
      />
    )
  }

  const totalMonths = monthHeaders.length

  return (
    <div className="space-y-4">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomIndex === 0} className="gap-1">
          <ZoomOut className="h-3.5 w-3.5" />
          Zoom Out
        </Button>
        <div className="text-xs text-muted-foreground tabular-nums w-16 text-center">
          {Math.round((colWidth / ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]) * 100)}%
        </div>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1} className="gap-1">
          <ZoomIn className="h-3.5 w-3.5" />
          Zoom In
        </Button>
        <Button variant="ghost" size="sm" onClick={handleZoomReset} disabled={zoomIndex === DEFAULT_ZOOM_INDEX} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <div className="flex-1" />

        {/* Overlay toggles */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title="Show deliverables on timeline">
          <input type="checkbox" checked={showDeliverables} onChange={e => setShowDeliverables(e.target.checked)} className="accent-orange-500" />
          <FileText className="h-3 w-3 text-orange-500" />
          <span className="text-muted-foreground">Deliverables</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title="Show milestones on timeline">
          <input type="checkbox" checked={showMilestones} onChange={e => setShowMilestones(e.target.checked)} className="accent-violet-500" />
          <Target className="h-3 w-3 text-violet-500" />
          <span className="text-muted-foreground">Milestones</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title="Show reporting periods on timeline">
          <input type="checkbox" checked={showReporting} onChange={e => setShowReporting(e.target.checked)} className="accent-cyan-500" />
          <ClipboardList className="h-3 w-3 text-cyan-500" />
          <span className="text-muted-foreground">Reporting</span>
        </label>

        <Button variant="outline" size="sm" onClick={scrollToToday} className="gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
      </div>

      <div ref={scrollRef} className="rounded-lg border overflow-x-auto">
        <div style={{ minWidth: 200 + totalMonths * colWidth }}>
          {/* Header row */}
          <div className="flex border-b bg-muted/50">
            <div className="w-[200px] shrink-0 px-4 py-2 font-medium text-sm border-r">Project</div>
            <div className="flex">
              {monthHeaders.map((h, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-medium text-muted-foreground py-2 border-r"
                  style={{ width: colWidth }}
                >
                  {h.label}
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          {bars.map((bar) => {
            const startOffset = differenceInMonths(startOfMonth(bar.startDate), timelineStart)
            const duration = differenceInMonths(bar.endDate, bar.startDate) + 1
            const left = Math.max(0, startOffset) * colWidth
            const width = Math.max(1, duration) * colWidth

            const barColor = {
              Upcoming: 'bg-blue-400',
              Active: 'bg-green-400',
              Completed: 'bg-gray-400',
              Suspended: 'bg-red-400',
            }[bar.status] || 'bg-primary'

            return (
              <div key={bar.projectId} className="flex border-b last:border-0 hover:bg-muted/10">
                <div className="w-[200px] shrink-0 px-4 py-2 border-r">
                  <div className="font-semibold text-xs text-primary">{bar.acronym}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{bar.title}</div>
                </div>
                <div className="relative flex-1" style={{ height: 40 }}>
                  {/* Grid lines */}
                  {monthHeaders.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-r border-dashed border-muted"
                      style={{ left: i * colWidth }}
                    />
                  ))}
                  {/* Bar */}
                  <div
                    className={cn('absolute top-2 h-5 rounded-sm', barColor)}
                    style={{ left, width }}
                    title={`${bar.acronym}: ${format(bar.startDate, 'MMM yyyy')} — ${format(bar.endDate, 'MMM yyyy')}`}
                  >
                    <span className="px-1 text-[9px] text-white font-medium leading-5 truncate block">
                      {bar.acronym}
                    </span>
                  </div>

                  {/* Reporting period spans */}
                  {showReporting && (reportingByProject[bar.projectId] ?? []).map(rp => {
                    const rpStartDate = addMonths(bar.startDate, rp.start_month - 1)
                    const rpEndDate = addMonths(bar.startDate, rp.end_month)
                    const rpOffset = differenceInMonths(startOfMonth(rpStartDate), timelineStart)
                    const rpDuration = differenceInMonths(rpEndDate, rpStartDate)
                    const rpLeft = Math.max(0, rpOffset) * colWidth
                    const rpWidth = Math.max(1, rpDuration) * colWidth
                    return (
                      <div
                        key={`rp-${rp.id}`}
                        className="absolute bottom-0 h-[6px] bg-cyan-400/40 border border-cyan-500/50 rounded-sm"
                        style={{ left: rpLeft, width: rpWidth }}
                        title={`RP${rp.period_number}: M${rp.start_month}–M${rp.end_month}`}
                      />
                    )
                  })}

                  {/* Deliverable markers */}
                  {showDeliverables && (deliverablesByProject[bar.projectId] ?? []).map(d => {
                    if (!d.due_month) return null
                    const dDate = addMonths(bar.startDate, d.due_month - 1)
                    const dOffset = differenceInMonths(startOfMonth(dDate), timelineStart)
                    const dLeft = dOffset * colWidth + colWidth / 2 - 5
                    return (
                      <div
                        key={`del-${d.id}`}
                        className="absolute top-0"
                        style={{ left: dLeft }}
                        title={`${d.number}: ${d.title} (M${d.due_month})`}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" />
                        </svg>
                      </div>
                    )
                  })}

                  {/* Milestone markers */}
                  {showMilestones && (milestonesByProject[bar.projectId] ?? []).map(m => {
                    if (!m.due_month) return null
                    const mDate = addMonths(bar.startDate, m.due_month - 1)
                    const mOffset = differenceInMonths(startOfMonth(mDate), timelineStart)
                    const mLeft = mOffset * colWidth + colWidth / 2 - 5
                    return (
                      <div
                        key={`ms-${m.id}`}
                        className="absolute bottom-[6px]"
                        style={{ left: mLeft }}
                        title={`${m.number}: ${m.title} (M${m.due_month})`}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          { label: 'Upcoming', color: 'bg-blue-400' },
          { label: 'Active', color: 'bg-green-400' },
          { label: 'Completed', color: 'bg-gray-400' },
          { label: 'Suspended', color: 'bg-red-400' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={cn('inline-block w-3 h-3 rounded-sm', item.color)} />
            <span>{item.label}</span>
          </div>
        ))}
        {showDeliverables && (
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" /></svg>
            <span>Deliverable</span>
          </div>
        )}
        {showMilestones && (
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" /></svg>
            <span>Milestone</span>
          </div>
        )}
        {showReporting && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-[6px] rounded-sm bg-cyan-400/60 border border-cyan-500/50" />
            <span>Reporting Period</span>
          </div>
        )}
      </div>
    </div>
  )
}
