import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isBefore, isAfter } from 'date-fns'
import type { ProjectStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currency = 'EUR'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCurrencyDetailed(amount: number | null | undefined, currency = 'EUR'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  return value.toFixed(decimals)
}

export function formatPms(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toFixed(3)
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

export function computeProjectStatus(startDate: string, endDate: string, currentStatus?: string): ProjectStatus {
  if (currentStatus === 'Suspended') return 'Suspended'

  const now = new Date()
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (isBefore(now, start)) return 'Upcoming'
  if (isAfter(now, end)) return 'Completed'
  return 'Active'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800',
    Upcoming: 'bg-blue-100 text-blue-800',
    Completed: 'bg-gray-100 text-gray-800',
    Suspended: 'bg-red-100 text-red-800',
    Draft: 'bg-slate-100 text-slate-800',
    Confirmed: 'bg-blue-100 text-blue-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[month - 1] || ''
}

export function getMonthsInYear(): { month: number; name: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    name: getMonthName(i + 1),
  }))
}

export function getYearOptions(range = 5): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: range * 2 + 1 }, (_, i) => currentYear - range + i)
}

export function clampPms(value: number): number {
  return Math.max(0, Math.min(12, Math.round(value * 1000) / 1000))
}

export function getSalaryRecoveryColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600'
  if (percentage >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export function getSalaryRecoveryBgColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-100'
  if (percentage >= 50) return 'bg-amber-100'
  return 'bg-red-100'
}
