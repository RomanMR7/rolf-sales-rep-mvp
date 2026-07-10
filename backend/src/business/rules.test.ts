import { describe, expect, test } from 'bun:test'

import { AppError } from '../http/errors'
import {
  assertOwns,
  assertProductEditAllowed,
  calculateOrderTotals,
  nextOrderStatus,
  nextVisitStatus,
} from './rules'

const rep = { id: 'rep-1', role: 'MANAGER' as const }
const supervisor = { id: 'manager-1', role: 'SUPERVISOR' as const }

describe('business access rules', () => {
  test('sales rep cannot access another rep client or order', () => {
    expect(() => assertOwns(rep, 'rep-2')).toThrow(AppError)
    expect(() => assertOwns(rep, 'rep-1')).not.toThrow()
    expect(() => assertOwns(supervisor, 'rep-2')).not.toThrow()
  })

  test('sales rep cannot edit products', () => {
    expect(() => assertProductEditAllowed(rep)).toThrow(AppError)
    expect(() => assertProductEditAllowed(supervisor)).not.toThrow()
  })

  test('sales rep cannot approve order but manager can approve submitted order', () => {
    expect(() => nextOrderStatus(rep, 'SUBMITTED', 'approve')).toThrow(AppError)
    expect(nextOrderStatus(supervisor, 'SUBMITTED', 'approve')).toBe('APPROVED')
  })

  test('order total calculation works', () => {
    expect(
      calculateOrderTotals(
        [
          { quantity: 2, unitPrice: 100, discount: 10 },
          { quantity: 1, unitPrice: 50 },
        ],
        5,
      ),
    ).toEqual({ subtotal: 250, discount: 15, total: 235 })
  })

  test('visit start and complete transitions work', () => {
    expect(nextVisitStatus('PLANNED', 'start')).toBe('IN_PROGRESS')
    expect(nextVisitStatus('IN_PROGRESS', 'complete')).toBe('COMPLETED')
    expect(() => nextVisitStatus('PLANNED', 'complete')).toThrow(AppError)
  })
})
