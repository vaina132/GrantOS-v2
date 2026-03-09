/**
 * Canonical PM ↔ Hours conversion utilities.
 *
 * Single source of truth for the formula:
 *   1 PM = workingDaysInMonth × hoursPerDay
 *
 * Example: 22 working days × 8 h/day = 176 h = 1.00 PM
 */

/** Count weekday (Mon-Fri) dates in a given month/year (excludes holidays) */
export function getWorkingDaysInMonth(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

/** Monthly capacity in hours for 1.0 FTE */
export function monthCapacityHours(workingDays: number, hoursPerDay: number): number {
  return workingDays * hoursPerDay
}

/** Convert hours → PM for a given month */
export function hoursToPm(hours: number, workingDays: number, hoursPerDay: number): number {
  const cap = monthCapacityHours(workingDays, hoursPerDay)
  if (cap <= 0) return 0
  return Math.round((hours / cap) * 10000) / 10000
}

/** Convert PM → hours for a given month */
export function pmToHours(pms: number, workingDays: number, hoursPerDay: number): number {
  return Math.round(pms * workingDays * hoursPerDay * 100) / 100
}

/** Format PM value for display (e.g. "0.25 PM") */
export function formatPm(pms: number): string {
  if (pms === 0) return '0 PM'
  if (pms >= 0.01) return `${pms.toFixed(2)} PM`
  return `${pms.toFixed(4)} PM`
}

/** Format hours value for display (e.g. "48h") */
export function formatHours(hours: number): string {
  if (hours === 0) return '0h'
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`
}

/** Format a combined display: "48h (0.27 PM)" */
export function formatHoursWithPm(hours: number, workingDays: number, hoursPerDay: number): string {
  const pm = hoursToPm(hours, workingDays, hoursPerDay)
  return `${formatHours(hours)} (${formatPm(pm)})`
}

/** Format a combined display: "0.27 PM (48h)" */
export function formatPmWithHours(pms: number, workingDays: number, hoursPerDay: number): string {
  const hours = pmToHours(pms, workingDays, hoursPerDay)
  return `${formatPm(pms)} (${formatHours(hours)})`
}
