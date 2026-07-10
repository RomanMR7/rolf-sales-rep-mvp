import { AppError } from '../http/errors'

export type Role = 'ADMIN' | 'MANAGER' | 'SALES_REP'

export type Actor = {
  id: string
  role: Role
}

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'

export type VisitStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export function isManagerRole(actor: Actor) {
  return actor.role === 'ADMIN' || actor.role === 'MANAGER'
}

export function assertManager(actor: Actor) {
  if (!isManagerRole(actor)) {
    throw new AppError(403, 'FORBIDDEN', 'Manager or admin role is required')
  }
}

export function assertOwns(actor: Actor, ownerId: string) {
  if (isManagerRole(actor) || actor.id === ownerId) return
  throw new AppError(403, 'FORBIDDEN', 'You can access only your own records')
}

export function assertProductEditAllowed(actor: Actor) {
  assertManager(actor)
}

export function calculateOrderTotals(
  items: Array<{ quantity: number; unitPrice: number; discount?: number }>,
  orderDiscount = 0,
) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  )
  const itemDiscount = roundMoney(items.reduce((sum, item) => sum + (item.discount ?? 0), 0))
  const discount = roundMoney(itemDiscount + orderDiscount)
  const total = roundMoney(Math.max(0, subtotal - discount))
  return { subtotal, discount, total }
}

export function lineTotal(item: { quantity: number; unitPrice: number; discount?: number }) {
  return roundMoney(Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0)))
}

export function nextOrderStatus(actor: Actor, current: OrderStatus, action: 'submit' | 'approve' | 'reject' | 'cancel' | 'deliver' | 'complete') {
  if (current === 'COMPLETED' || current === 'CANCELLED') {
    throw new AppError(409, 'CONFLICT', 'Final orders cannot be changed')
  }

  if (action === 'submit') {
    if (current !== 'DRAFT') throw new AppError(409, 'CONFLICT', 'Only draft orders can be submitted')
    return 'SUBMITTED' satisfies OrderStatus
  }

  if (action === 'cancel') {
    if (current !== 'DRAFT' && current !== 'SUBMITTED') {
      throw new AppError(409, 'CONFLICT', 'Only draft or submitted orders can be cancelled')
    }
    return 'CANCELLED' satisfies OrderStatus
  }

  assertManager(actor)

  if (action === 'approve' && current === 'SUBMITTED') return 'APPROVED' satisfies OrderStatus
  if (action === 'reject' && current === 'SUBMITTED') return 'REJECTED' satisfies OrderStatus
  if (action === 'deliver' && current === 'APPROVED') return 'IN_DELIVERY' satisfies OrderStatus
  if (action === 'complete' && current === 'IN_DELIVERY') return 'COMPLETED' satisfies OrderStatus

  throw new AppError(409, 'CONFLICT', `Cannot ${action} order in status ${current}`)
}

export function nextVisitStatus(current: VisitStatus, action: 'start' | 'complete' | 'skip') {
  if (action === 'start') {
    if (current !== 'PLANNED') throw new AppError(409, 'CONFLICT', 'Only planned visits can be started')
    return 'IN_PROGRESS' satisfies VisitStatus
  }
  if (action === 'complete') {
    if (current !== 'IN_PROGRESS') throw new AppError(409, 'CONFLICT', 'Only in-progress visits can be completed')
    return 'COMPLETED' satisfies VisitStatus
  }
  if (current === 'COMPLETED') throw new AppError(409, 'CONFLICT', 'Completed visits cannot be skipped')
  return 'SKIPPED' satisfies VisitStatus
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
