import { describe, it, expect } from 'vitest'
import {
  computeAnnualBudgets,
  personnelCost,
  aggregatePersonnelCosts,
  isYearInRange,
} from './financialCalcs'

describe('computeAnnualBudgets', () => {
  it('distributes budget evenly across project years', () => {
    const result = computeAnnualBudgets({
      start_date: '2024-01-01',
      end_date: '2026-12-31',
      budget_personnel: 300000,
      budget_travel: 30000,
      budget_subcontracting: 60000,
      budget_other: 15000,
      total_budget: 500000,
      overhead_rate: 25,
    })

    // 3-year project
    expect(result.personnel).toBe(100000)
    expect(result.travel).toBe(10000)
    expect(result.subcontracting).toBe(20000)
    expect(result.other).toBe(5000)
    expect(result.indirect).toBe(41666.67) // 500000 * 25% / 3
  })

  it('handles single-year project', () => {
    const result = computeAnnualBudgets({
      start_date: '2025-03-01',
      end_date: '2025-11-30',
      budget_personnel: 120000,
      budget_travel: 0,
      budget_subcontracting: 0,
      budget_other: 0,
      total_budget: 150000,
      overhead_rate: 0,
    })

    expect(result.personnel).toBe(120000)
    expect(result.indirect).toBe(0)
  })

  it('handles null budgets gracefully', () => {
    const result = computeAnnualBudgets({
      start_date: '2024-01-01',
      end_date: '2025-12-31',
      budget_personnel: null,
      budget_travel: null,
      budget_subcontracting: null,
      budget_other: null,
      total_budget: null,
      overhead_rate: null,
    })

    expect(result.personnel).toBe(0)
    expect(result.travel).toBe(0)
    expect(result.subcontracting).toBe(0)
    expect(result.other).toBe(0)
    expect(result.indirect).toBe(0)
  })
})

describe('personnelCost', () => {
  it('computes cost = pms × monthly salary', () => {
    // 60000 annual → 5000/month, 2 PMs → 10000
    expect(personnelCost(2, 60000)).toBe(10000)
  })

  it('handles fractional PMs', () => {
    // 0.5 PM × 48000/12 = 0.5 × 4000 = 2000
    expect(personnelCost(0.5, 48000)).toBe(2000)
  })

  it('handles zero salary', () => {
    expect(personnelCost(3, 0)).toBe(0)
  })

  it('handles zero PMs', () => {
    expect(personnelCost(0, 80000)).toBe(0)
  })
})

describe('aggregatePersonnelCosts', () => {
  it('sums costs per project', () => {
    const assignments = [
      { project_id: 'p1', pms: 2, annual_salary: 60000 },
      { project_id: 'p1', pms: 1, annual_salary: 48000 },
      { project_id: 'p2', pms: 3, annual_salary: 72000 },
    ]

    const result = aggregatePersonnelCosts(assignments)

    // p1: 2×5000 + 1×4000 = 14000
    expect(result.get('p1')).toBe(14000)
    // p2: 3×6000 = 18000
    expect(result.get('p2')).toBe(18000)
  })

  it('returns empty map for no assignments', () => {
    const result = aggregatePersonnelCosts([])
    expect(result.size).toBe(0)
  })
})

describe('isYearInRange', () => {
  it('returns true for years within project range', () => {
    expect(isYearInRange(2025, '2024-01-01', '2026-12-31')).toBe(true)
  })

  it('includes start year', () => {
    expect(isYearInRange(2024, '2024-01-01', '2026-12-31')).toBe(true)
  })

  it('includes end year', () => {
    expect(isYearInRange(2026, '2024-01-01', '2026-12-31')).toBe(true)
  })

  it('returns false for years before project', () => {
    expect(isYearInRange(2023, '2024-01-01', '2026-12-31')).toBe(false)
  })

  it('returns false for years after project', () => {
    expect(isYearInRange(2027, '2024-01-01', '2026-12-31')).toBe(false)
  })
})
