import { useMemo, useState, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, CalendarDays, FileText, Target, ClipboardList, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseISO, differenceInMonths, startOfMonth, addMonths, format, getDaysInMonth } from 'date-fns'
import type { CollabProject, CollabPartner, CollabWorkPackage, CollabTask, CollabDeliverable, CollabMilestone, CollabReportingPeriod } from '@/types'

const ZOOM_LEVELS = [20, 30, 40, 60, 80, 110, 150]
const DEFAULT_ZOOM_INDEX = 3

interface CollabGanttChartProps {
  project: CollabProject
  partners: CollabPartner[]
  wps: CollabWorkPackage[]
  tasksByWp: Record<string, CollabTask[]>
  deliverables: CollabDeliverable[]
  milestones: CollabMilestone[]
  periods: CollabReportingPeriod[]
}

export function CollabGanttChart({
  project, partners, wps, tasksByWp, deliverables, milestones, periods,
}: CollabGanttChartProps) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Overlay visibility toggles
  const [showTasks, setShowTasks] = useState(true)
  const [showDeliverables, setShowDeliverables] = useState(true)
  const [showMilestones, setShowMilestones] = useState(true)
  const [showReporting, setShowReporting] = useState(true)

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

  const { monthHeaders, timelineStart, totalMonths } = useMemo(() => {
    if (!project.start_date || !project.duration_months) {
      return { monthHeaders: [], timelineStart: new Date(), totalMonths: 0, projectStart: new Date() }
    }

    const pStart = parseISO(project.start_date)
    const tStart = startOfMonth(pStart)
    const dur = project.duration_months + 1 // extra month buffer

    const headers: { label: string; month: number; date: Date }[] = []
    for (let i = 0; i < dur; i++) {
      const d = addMonths(tStart, i)
      headers.push({ label: format(d, 'MMM yy'), month: i + 1, date: d })
    }

    return { monthHeaders: headers, timelineStart: tStart, totalMonths: dur, projectStart: pStart }
  }, [project.start_date, project.duration_months])

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return
    const today = new Date()
    const monthsFromStart = differenceInMonths(today, timelineStart)
    const scrollLeft = Math.max(0, monthsFromStart * colWidth - scrollRef.current.clientWidth / 2)
    scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [timelineStart, colWidth])

  // Helper: get month position in pixels
  const monthToLeft = useCallback((month: number) => {
    return Math.max(0, (month - 1)) * colWidth
  }, [colWidth])

  const monthToWidth = useCallback((startMonth: number, endMonth: number) => {
    return Math.max(1, endMonth - startMonth + 1) * colWidth
  }, [colWidth])

  if (!project.start_date || !project.duration_months) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Set project start date and duration to see the Gantt chart.</p>
      </div>
    )
  }

  if (wps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Add work packages to see the Gantt chart.</p>
      </div>
    )
  }

  // Today line position — precise fractional month from timeline start
  const today = new Date()
  const wholeMonths = differenceInMonths(today, timelineStart)
  const monthStart = addMonths(timelineStart, wholeMonths)
  const dayFraction = (today.getTime() - monthStart.getTime()) / (getDaysInMonth(monthStart) * 86400000)
  const todayMonth = wholeMonths + 1
  const todayLeft = (wholeMonths + dayFraction) * colWidth

  // Row height
  const ROW_H = 44
  const TASK_ROW_H = 32

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomIndex === 0} className="gap-1">
          <ZoomOut className="h-3.5 w-3.5" /> Zoom Out
        </Button>
        <div className="text-xs text-muted-foreground tabular-nums w-16 text-center">
          {Math.round((colWidth / ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]) * 100)}%
        </div>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1} className="gap-1">
          <ZoomIn className="h-3.5 w-3.5" /> Zoom In
        </Button>
        <Button variant="ghost" size="sm" onClick={handleZoomReset} disabled={zoomIndex === DEFAULT_ZOOM_INDEX} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <div className="flex-1" />

        {/* Toggles */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} className="accent-blue-500" />
          <Layers className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">Tasks</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showDeliverables} onChange={e => setShowDeliverables(e.target.checked)} className="accent-orange-500" />
          <FileText className="h-3 w-3 text-orange-500" />
          <span className="text-muted-foreground">Deliverables</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showMilestones} onChange={e => setShowMilestones(e.target.checked)} className="accent-violet-500" />
          <Target className="h-3 w-3 text-violet-500" />
          <span className="text-muted-foreground">Milestones</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showReporting} onChange={e => setShowReporting(e.target.checked)} className="accent-cyan-500" />
          <ClipboardList className="h-3 w-3 text-cyan-500" />
          <span className="text-muted-foreground">Reporting</span>
        </label>

        <Button variant="outline" size="sm" onClick={scrollToToday} className="gap-1">
          <CalendarDays className="h-3.5 w-3.5" /> Today
        </Button>
      </div>

      {/* Chart */}
      <div ref={scrollRef} className="rounded-lg border overflow-x-auto overflow-y-auto max-h-[70vh]">
        <div style={{ minWidth: 240 + totalMonths * colWidth }}>
          {/* Header row */}
          <div className="flex border-b bg-muted/50 sticky top-0 z-10">
            <div className="w-[240px] shrink-0 px-4 py-2 font-medium text-sm border-r bg-muted/50">
              Work Packages
            </div>
            <div className="flex relative">
              {monthHeaders.map((h, i) => (
                <div
                  key={i}
                  className="text-center border-r"
                  style={{ width: colWidth }}
                >
                  <div className="text-[10px] font-medium text-muted-foreground py-1">{h.label}</div>
                  <div className="text-[8px] text-muted-foreground/50 pb-1">M{h.month}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reporting periods row (if enabled) */}
          {showReporting && periods.length > 0 && (
            <div className="flex border-b bg-cyan-50/30 dark:bg-cyan-950/10">
              <div className="w-[240px] shrink-0 px-4 py-1.5 border-r text-xs text-cyan-700 dark:text-cyan-400 font-medium flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" /> Reporting Periods
              </div>
              <div className="relative flex-1" style={{ height: 28 }}>
                {/* Grid */}
                {monthHeaders.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/50" style={{ left: i * colWidth }} />
                ))}
                {periods.map(rp => {
                  const rpLeft = monthToLeft(rp.start_month)
                  const rpWidth = monthToWidth(rp.start_month, rp.end_month)
                  return (
                    <div
                      key={rp.id}
                      className="absolute top-1 h-[20px] bg-cyan-400/20 border border-cyan-500/40 rounded-sm group/rp cursor-pointer flex items-center justify-center"
                      style={{ left: rpLeft, width: rpWidth, zIndex: 2 }}
                    >
                      <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-medium truncate px-1">
                        {rp.title}
                      </span>
                      <div className="hidden group-hover/rp:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
                        <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                          <div className="font-semibold text-cyan-600">{rp.title}</div>
                          <div className="text-muted-foreground">M{rp.start_month} – M{rp.end_month} ({rp.period_type})</div>
                          {rp.due_date && <div className="text-muted-foreground">Due: {rp.due_date}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {/* Today line */}
                {todayMonth > 0 && todayMonth <= totalMonths && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-20" style={{ left: todayLeft }} />
                )}
              </div>
            </div>
          )}

          {/* WP rows */}
          {wps.map(wp => {
            const tasks = tasksByWp[wp.id] ?? []
            const leader = wp.leader_partner_id ? partners.find(p => p.id === wp.leader_partner_id) : null
            const wpStart = wp.start_month ?? 1
            const wpEnd = wp.end_month ?? (project.duration_months || 36)

            // Deliverables/milestones for this WP
            const wpDeliverables = deliverables.filter(d => d.wp_id === wp.id)
            const wpMilestones = milestones.filter(m => m.wp_id === wp.id)

            return (
              <div key={wp.id}>
                {/* WP bar */}
                <div className="flex border-b hover:bg-muted/10">
                  <div className="w-[240px] shrink-0 px-4 py-2 border-r">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">WP{wp.wp_number}</Badge>
                      <span className="font-medium text-xs truncate">{wp.title}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 pl-0.5">
                      {leader && <span>Lead: {leader.org_name}</span>}
                      <span>{wp.total_person_months} PMs</span>
                    </div>
                  </div>
                  <div className="relative flex-1" style={{ height: ROW_H }}>
                    {/* Grid */}
                    {monthHeaders.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/30" style={{ left: i * colWidth }} />
                    ))}
                    {/* WP bar */}
                    <div
                      className="absolute top-2 h-6 rounded bg-primary/20 border border-primary/30"
                      style={{ left: monthToLeft(wpStart), width: monthToWidth(wpStart, wpEnd) }}
                      title={`WP${wp.wp_number}: M${wpStart}–M${wpEnd}`}
                    >
                      <span className="px-1.5 text-[9px] text-primary font-medium leading-6 truncate block">
                        WP{wp.wp_number}
                      </span>
                    </div>

                    {/* Deliverable markers for this WP */}
                    {showDeliverables && wpDeliverables.map(d => {
                      const dLeft = monthToLeft(d.due_month) + colWidth / 2 - 5
                      const dLeader = d.leader_partner_id ? partners.find(p => p.id === d.leader_partner_id) : null
                      return (
                        <div key={`del-${d.id}`} className="absolute top-0.5 group/del cursor-pointer" style={{ left: dLeft, zIndex: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" />
                          </svg>
                          <div className="hidden group-hover/del:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                            <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                              <div className="font-semibold text-orange-600">{d.number}</div>
                              <div className="font-medium">{d.title}</div>
                              <div className="text-muted-foreground">Due: M{d.due_month} · {d.type || 'N/A'}</div>
                              {dLeader && <div className="text-muted-foreground">Lead: {dLeader.org_name}</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Milestone markers for this WP */}
                    {showMilestones && wpMilestones.map(m => {
                      const mLeft = monthToLeft(m.due_month) + colWidth / 2 - 5
                      return (
                        <div key={`ms-${m.id}`} className="absolute bottom-1 group/ms cursor-pointer" style={{ left: mLeft, zIndex: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" />
                          </svg>
                          <div className="hidden group-hover/ms:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                            <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                              <div className="font-semibold text-violet-600">{m.number}</div>
                              <div className="font-medium">{m.title}</div>
                              <div className="text-muted-foreground">Due: M{m.due_month}</div>
                              {m.verification_means && <div className="text-muted-foreground max-w-[200px] truncate">{m.verification_means}</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Today line */}
                    {todayMonth > 0 && todayMonth <= totalMonths && (
                      <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-20" style={{ left: todayLeft }} />
                    )}
                  </div>
                </div>

                {/* Task rows */}
                {showTasks && tasks.map(t => {
                  const taskLeader = t.leader_partner_id ? partners.find(p => p.id === t.leader_partner_id) : null
                  const tStart = t.start_month ?? wpStart
                  const tEnd = t.end_month ?? wpEnd
                  return (
                    <div key={t.id} className="flex border-b bg-muted/[0.02] hover:bg-muted/10">
                      <div className="w-[240px] shrink-0 px-4 py-1.5 border-r pl-10">
                        <div className="text-[11px] font-medium truncate">{t.task_number} — {t.title}</div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                          {taskLeader && <span>Lead: {taskLeader.org_name}</span>}
                          {t.person_months > 0 && <span>{t.person_months} PMs</span>}
                        </div>
                      </div>
                      <div className="relative flex-1" style={{ height: TASK_ROW_H }}>
                        {/* Grid */}
                        {monthHeaders.map((_, i) => (
                          <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/20" style={{ left: i * colWidth }} />
                        ))}
                        {/* Task bar */}
                        <div
                          className="absolute top-1.5 h-4 rounded-sm bg-blue-400/30 border border-blue-400/40"
                          style={{ left: monthToLeft(tStart), width: monthToWidth(tStart, tEnd) }}
                          title={`${t.task_number}: M${tStart}–M${tEnd}`}
                        >
                          <span className="px-1 text-[8px] text-blue-700 dark:text-blue-300 font-medium leading-4 truncate block">
                            {t.task_number}
                          </span>
                        </div>
                        {/* Today line */}
                        {todayMonth > 0 && todayMonth <= totalMonths && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-20" style={{ left: todayLeft }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Unassigned deliverables/milestones (no WP) */}
          {(() => {
            const unassignedDels = deliverables.filter(d => !d.wp_id)
            const unassignedMs = milestones.filter(m => !m.wp_id)
            if (unassignedDels.length === 0 && unassignedMs.length === 0) return null
            return (
              <div className="flex border-b bg-muted/[0.04]">
                <div className="w-[240px] shrink-0 px-4 py-2 border-r">
                  <span className="text-xs text-muted-foreground italic">Unassigned items</span>
                </div>
                <div className="relative flex-1" style={{ height: ROW_H }}>
                  {monthHeaders.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/30" style={{ left: i * colWidth }} />
                  ))}
                  {showDeliverables && unassignedDels.map(d => {
                    const dLeft = monthToLeft(d.due_month) + colWidth / 2 - 5
                    return (
                      <div key={`del-${d.id}`} className="absolute top-2 group/del cursor-pointer" style={{ left: dLeft, zIndex: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" />
                        </svg>
                        <div className="hidden group-hover/del:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                          <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <div className="font-semibold text-orange-600">{d.number}</div>
                            <div className="font-medium">{d.title}</div>
                            <div className="text-muted-foreground">Due: M{d.due_month}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {showMilestones && unassignedMs.map(m => {
                    const mLeft = monthToLeft(m.due_month) + colWidth / 2 - 5
                    return (
                      <div key={`ms-${m.id}`} className="absolute bottom-2 group/ms cursor-pointer" style={{ left: mLeft, zIndex: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" />
                        </svg>
                        <div className="hidden group-hover/ms:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                          <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <div className="font-semibold text-violet-600">{m.number}</div>
                            <div className="font-medium">{m.title}</div>
                            <div className="text-muted-foreground">Due: M{m.due_month}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {todayMonth > 0 && todayMonth <= totalMonths && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-20" style={{ left: todayLeft }} />
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded bg-primary/20 border border-primary/30" />
          <span>Work Package</span>
        </div>
        {showTasks && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-4 h-2.5 rounded-sm bg-blue-400/30 border border-blue-400/40" />
            <span>Task</span>
          </div>
        )}
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
            <span className="inline-block w-4 h-[8px] rounded-sm bg-cyan-400/20 border border-cyan-500/40" />
            <span>Reporting Period</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="inline-block w-0.5 h-3 bg-red-500/60" />
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
