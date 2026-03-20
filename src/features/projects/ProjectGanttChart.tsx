import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ZoomIn, ZoomOut, RotateCcw, CalendarDays, FileText, Target, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseISO, differenceInMonths, startOfMonth, addMonths, format, getDaysInMonth } from 'date-fns'
import { deliverablesService } from '@/services/deliverablesService'
import type { Project, WorkPackage, Deliverable, Milestone, ReportingPeriod } from '@/types'

const ZOOM_LEVELS = [20, 30, 40, 60, 80, 110, 150]
const DEFAULT_ZOOM_INDEX = 3

interface ProjectGanttChartProps {
  project: Project
  workPackages: WorkPackage[]
  projectMonthCount: number
}

export function ProjectGanttChart({ project, workPackages, projectMonthCount }: ProjectGanttChartProps) {
  const { t } = useTranslation()
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [showDeliverables, setShowDeliverables] = useState(true)
  const [showMilestones, setShowMilestones] = useState(true)
  const [showReporting, setShowReporting] = useState(true)

  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])

  useEffect(() => {
    if (!project.id) return
    deliverablesService.listDeliverables(project.id).then(setDeliverables).catch(() => {})
    deliverablesService.listMilestones(project.id).then(setMilestones).catch(() => {})
    deliverablesService.listReportingPeriods(project.id).then(setPeriods).catch(() => {})
  }, [project.id])

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
    if (!project.start_date || projectMonthCount <= 0) {
      return { monthHeaders: [], timelineStart: new Date(), totalMonths: 0 }
    }

    const pStart = parseISO(project.start_date)
    const tStart = startOfMonth(pStart)
    const dur = projectMonthCount + 1

    const headers: { label: string; month: number; date: Date }[] = []
    for (let i = 0; i < dur; i++) {
      const d = addMonths(tStart, i)
      headers.push({ label: format(d, 'MMM yy'), month: i + 1, date: d })
    }

    return { monthHeaders: headers, timelineStart: tStart, totalMonths: dur }
  }, [project.start_date, projectMonthCount])

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return
    const today = new Date()
    const monthsFromStart = differenceInMonths(today, timelineStart)
    const scrollLeft = Math.max(0, monthsFromStart * colWidth - scrollRef.current.clientWidth / 2)
    scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [timelineStart, colWidth])

  const monthToLeft = useCallback((month: number) => {
    return Math.max(0, (month - 1)) * colWidth
  }, [colWidth])

  const monthToWidth = useCallback((startMonth: number, endMonth: number) => {
    return Math.max(1, endMonth - startMonth + 1) * colWidth
  }, [colWidth])

  if (!project.start_date || !project.end_date) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">{t('collaboration.setStartDateForGantt')}</p>
      </div>
    )
  }

  if (workPackages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">{t('collaboration.addWpsForGantt')}</p>
      </div>
    )
  }

  const today = new Date()
  const wholeMonths = differenceInMonths(today, timelineStart)
  const monthStart = addMonths(timelineStart, wholeMonths)
  const dayFraction = (today.getTime() - monthStart.getTime()) / (getDaysInMonth(monthStart) * 86400000)
  const todayMonth = wholeMonths + 1
  const todayLeft = (wholeMonths + dayFraction) * colWidth

  const ROW_H = 44

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomIndex === 0} className="gap-1">
          <ZoomOut className="h-3.5 w-3.5" /> {t('collaboration.zoomOut')}
        </Button>
        <div className="text-xs text-muted-foreground tabular-nums w-16 text-center">
          {Math.round((colWidth / ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]) * 100)}%
        </div>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1} className="gap-1">
          <ZoomIn className="h-3.5 w-3.5" /> {t('collaboration.zoomIn')}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleZoomReset} disabled={zoomIndex === DEFAULT_ZOOM_INDEX} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> {t('common.reset')}
        </Button>
        <div className="flex-1" />

        {/* Toggles */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showDeliverables} onChange={e => setShowDeliverables(e.target.checked)} className="accent-orange-500" />
          <FileText className="h-3 w-3 text-orange-500" />
          <span className="text-muted-foreground">{t('projects.deliverables')}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showMilestones} onChange={e => setShowMilestones(e.target.checked)} className="accent-violet-500" />
          <Target className="h-3 w-3 text-violet-500" />
          <span className="text-muted-foreground">{t('projects.milestones')}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showReporting} onChange={e => setShowReporting(e.target.checked)} className="accent-cyan-500" />
          <ClipboardList className="h-3 w-3 text-cyan-500" />
          <span className="text-muted-foreground">{t('projects.reporting')}</span>
        </label>

        <Button variant="outline" size="sm" onClick={scrollToToday} className="gap-1">
          <CalendarDays className="h-3.5 w-3.5" /> {t('collaboration.today')}
        </Button>
      </div>

      {/* Chart */}
      <div ref={scrollRef} className="rounded-lg border overflow-x-auto overflow-y-auto max-h-[70vh]">
        <div style={{ minWidth: 240 + totalMonths * colWidth }}>
          {/* Header row */}
          <div className="flex border-b bg-muted/50 sticky top-0 z-10">
            <div className="w-[240px] shrink-0 px-4 py-2 font-medium text-sm border-r bg-muted/50">
              {t('projects.workPackages')}
            </div>
            <div className="flex relative">
              {monthHeaders.map((h, i) => (
                <div key={i} className="text-center border-r" style={{ width: colWidth }}>
                  <div className="text-[10px] font-medium text-muted-foreground py-1">{h.label}</div>
                  <div className="text-[8px] text-muted-foreground/50 pb-1">M{h.month}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reporting periods row */}
          {showReporting && periods.length > 0 && (
            <div className="flex border-b bg-cyan-50/30 dark:bg-cyan-950/10">
              <div className="w-[240px] shrink-0 px-4 py-1.5 border-r text-xs text-cyan-700 dark:text-cyan-400 font-medium flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" /> {t('projects.reporting')}
              </div>
              <div className="relative flex-1" style={{ height: 28 }}>
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
                        RP{rp.period_number}
                      </span>
                      <div className="hidden group-hover/rp:block absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-[100] pointer-events-none">
                        <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                          <div className="font-semibold text-cyan-600">RP{rp.period_number}</div>
                          <div className="text-muted-foreground">M{rp.start_month} – M{rp.end_month}</div>
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
          )}

          {/* WP rows */}
          {workPackages.map(wp => {
            const wpStart = wp.start_month ?? 1
            const wpEnd = wp.end_month ?? projectMonthCount

            const wpDeliverables = deliverables.filter((d): d is Deliverable & { due_month: number } => d.work_package_id === wp.id && d.due_month != null)
            const wpMilestones = milestones.filter((m): m is Milestone & { due_month: number } => m.work_package_id === wp.id && m.due_month != null)

            return (
              <div key={wp.id}>
                <div className="flex border-b hover:bg-muted/10 relative hover:z-40">
                  <div className="w-[240px] shrink-0 px-4 py-2 border-r">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">WP{wp.number}</Badge>
                      <span className="font-medium text-xs truncate">{wp.name}</span>
                    </div>
                    {wp.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 pl-0.5 truncate max-w-[200px]">
                        {wp.description}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1" style={{ height: ROW_H }}>
                    {monthHeaders.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/30" style={{ left: i * colWidth }} />
                    ))}
                    {/* WP bar */}
                    <div
                      className="absolute top-2 h-6 rounded bg-primary/20 border border-primary/30"
                      style={{ left: monthToLeft(wpStart), width: monthToWidth(wpStart, wpEnd) }}
                      title={`WP${wp.number}: M${wpStart}–M${wpEnd}`}
                    >
                      <span className="px-1.5 text-[9px] text-primary font-medium leading-6 truncate block">
                        WP{wp.number}
                      </span>
                    </div>

                    {/* Deliverable markers */}
                    {showDeliverables && wpDeliverables.map(d => {
                      const dLeft = monthToLeft(d.due_month!) + colWidth / 2 - 5
                      return (
                        <div key={`del-${d.id}`} className="absolute top-0.5 group/del cursor-pointer" style={{ left: dLeft, zIndex: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" />
                          </svg>
                          <div className="hidden group-hover/del:block absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] pointer-events-none">
                            <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                              <div className="font-semibold text-orange-600">{d.number}</div>
                              <div className="font-medium">{d.title}</div>
                              <div className="text-muted-foreground">{t('collaboration.due')}: M{d.due_month}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Milestone markers */}
                    {showMilestones && wpMilestones.map(m => {
                      const mLeft = monthToLeft(m.due_month!) + colWidth / 2 - 5
                      return (
                        <div key={`ms-${m.id}`} className="absolute bottom-1 group/ms cursor-pointer" style={{ left: mLeft, zIndex: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" />
                          </svg>
                          <div className="hidden group-hover/ms:block absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] pointer-events-none">
                            <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                              <div className="font-semibold text-violet-600">{m.number}</div>
                              <div className="font-medium">{m.title}</div>
                              <div className="text-muted-foreground">{t('collaboration.due')}: M{m.due_month!}</div>
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
              </div>
            )
          })}

          {/* Unassigned deliverables/milestones */}
          {(() => {
            const unassignedDels = deliverables.filter((d): d is Deliverable & { due_month: number } => !d.work_package_id && d.due_month != null)
            const unassignedMs = milestones.filter((m): m is Milestone & { due_month: number } => !m.work_package_id && m.due_month != null)
            if (unassignedDels.length === 0 && unassignedMs.length === 0) return null
            return (
              <div className="flex border-b bg-muted/[0.04] relative hover:z-40">
                <div className="w-[240px] shrink-0 px-4 py-2 border-r">
                  <span className="text-xs text-muted-foreground italic">{t('collaboration.unassignedItems')}</span>
                </div>
                <div className="relative flex-1" style={{ height: ROW_H }}>
                  {monthHeaders.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-muted/30" style={{ left: i * colWidth }} />
                  ))}
                  {showDeliverables && unassignedDels.map(d => {
                    const dLeft = monthToLeft(d.due_month!) + colWidth / 2 - 5
                    return (
                      <div key={`del-${d.id}`} className="absolute top-2 group/del cursor-pointer" style={{ left: dLeft, zIndex: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" />
                        </svg>
                        <div className="hidden group-hover/del:block absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] pointer-events-none">
                          <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <div className="font-semibold text-orange-600">{d.number}</div>
                            <div className="font-medium">{d.title}</div>
                            <div className="text-muted-foreground">{t('collaboration.due')}: M{d.due_month}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {showMilestones && unassignedMs.map(m => {
                    const mLeft = monthToLeft(m.due_month!) + colWidth / 2 - 5
                    return (
                      <div key={`ms-${m.id}`} className="absolute bottom-2 group/ms cursor-pointer" style={{ left: mLeft, zIndex: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" />
                        </svg>
                        <div className="hidden group-hover/ms:block absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] pointer-events-none">
                          <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <div className="font-semibold text-violet-600">{m.number}</div>
                            <div className="font-medium">{m.title}</div>
                            <div className="text-muted-foreground">{t('collaboration.due')}: M{m.due_month}</div>
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
          <span>{t('collaboration.workPackage')}</span>
        </div>
        {showDeliverables && (
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,5 5,10 0,5" className="fill-orange-500" /></svg>
            <span>{t('collaboration.deliverable')}</span>
          </div>
        )}
        {showMilestones && (
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,5 5,10 0,5" className="fill-violet-500" /></svg>
            <span>{t('collaboration.milestone')}</span>
          </div>
        )}
        {showReporting && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-4 h-[8px] rounded-sm bg-cyan-400/20 border border-cyan-500/40" />
            <span>{t('collaboration.reportingPeriod')}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="inline-block w-0.5 h-3 bg-red-500/60" />
          <span>{t('collaboration.today')}</span>
        </div>
      </div>
    </div>
  )
}
