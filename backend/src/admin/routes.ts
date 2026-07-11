import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { requireAuth, requirePermission, requireRole, type Role } from '../auth/middleware'
import type { DbClient } from '../db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../http/errors'
import type { AuthenticatedHonoEnv } from '../http/context'

const roleSchema = z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'])
const statusSchema = z.enum(['ACTIVE', 'BLOCKED', 'INVITED', 'DISABLED'])
const managerProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  workingStatus: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  dailyLimit: z.number().int().positive().nullable().optional(),
  monthlyLimit: z.number().int().positive().nullable().optional(),
})
const userCreateSchema = z.object({
  telegramId: z.string().trim().min(1).max(64).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.default('MANAGER'),
  status: statusSchema.default('INVITED'),
  supervisorId: z.string().uuid().nullable().optional(),
  profile: managerProfileSchema.optional(),
})
const userPatchSchema = userCreateSchema.partial().omit({ profile: true }).extend({
  profile: managerProfileSchema.optional(),
})
const functionPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  valueJson: z.unknown().optional(),
  enabled: z.boolean().optional(),
})
const scriptCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
  category: z.string().trim().max(80).nullable().optional(),
  enabled: z.boolean().default(true),
})
const scriptPatchSchema = scriptCreateSchema.partial()
const dealCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  clientName: z.string().trim().min(1).max(160),
  source: z.string().trim().max(80).nullable().optional(),
  status: z.enum(['NEW', 'TAKEN', 'IN_PROGRESS', 'SUCCESS', 'CANCELLED']).default('NEW'),
  amount: z.number().nonnegative().default(0),
  assignedManagerId: z.string().uuid().nullable().optional(),
})
const dealPatchSchema = dealCreateSchema.partial()
const manualMetricEntrySchema = z.object({
  managerId: z.string().uuid(),
  date: z.string().date(),
  mode: z.enum(['add', 'replace']).default('replace'),
  leadsNew: z.number().int().nonnegative().optional(),
  leadsTaken: z.number().int().nonnegative().optional(),
  dealsSuccess: z.number().int().nonnegative().optional(),
  dealsCancelled: z.number().int().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  avgResponseSeconds: z.number().int().nonnegative().optional(),
  messagesCount: z.number().int().nonnegative().optional(),
  note: z.string().trim().max(1000).optional(),
  source: z.enum(['manual_admin_entry', 'manual_bot_entry']).default('manual_admin_entry'),
})

export function createAdminRoutes(db: DbClient) {
  const routes = new Hono<AuthenticatedHonoEnv>()
  routes.use('*', requireAuth)

  routes.get('/users', requirePermission('users:manage'), async (c) => {
    const users = await db.user.findMany({
      include: { managerProfile: true, supervisor: true },
      orderBy: { createdAt: 'desc' },
    })
    return c.json({ users: users.map(userDto) })
  })

  routes.post('/users', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const input = userCreateSchema.parse(await c.req.json())
    assertCanChangeOwner(actor.role as Role, input.role)
    const displayName = input.displayName ?? ([input.firstName, input.lastName].filter(Boolean).join(' ') || input.username) ?? null
    const passwordHash = await Bun.password.hash(randomUUID())
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: telegramEmail(input.telegramId ?? randomUUID()),
          passwordHash,
          displayName,
          role: input.role,
          status: input.status,
          telegramId: input.telegramId,
          telegramUsername: input.username,
          telegramFirstName: input.firstName,
          telegramLastName: input.lastName,
          supervisorId: input.supervisorId ?? undefined,
          managerProfile: input.profile ? { create: input.profile } : undefined,
        },
        include: { managerProfile: true, supervisor: true },
      })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), created.id, 'user', created.id, 'manager_creation', input, auditActionSource(actor))
      return created
    })
    return c.json({ user: userDto(user) }, 201)
  })

  routes.patch('/users/:id', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const input = userPatchSchema.parse(await c.req.json())
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found')
    if (existing.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Only owner can update another owner')
    }
    if (input.role) assertCanChangeOwner(actor.role as Role, input.role)
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: userPatchInput(input),
        include: { managerProfile: true, supervisor: true },
      })
      if (input.profile) {
        await tx.managerProfile.upsert({
          where: { userId: id },
          create: { userId: id, ...input.profile },
          update: input.profile,
        })
      }
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), id, 'user', id, 'manager_update', input, auditActionSource(actor))
      return updated
    })
    return c.json({ user: userDto(user) })
  })

  routes.patch('/users/:id/role', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const { role } = z.object({ role: roleSchema }).parse(await c.req.json())
    assertCanChangeOwner(actor.role as Role, role)
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found')
    if (existing.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Admin cannot remove owner role')
    }
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { role }, include: { managerProfile: true, supervisor: true } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), id, 'user', id, 'role_change', { from: existing.role, to: role }, auditActionSource(actor))
      return updated
    })
    return c.json({ user: userDto(user) })
  })

  routes.patch('/users/:id/status', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const { status } = z.object({ status: statusSchema }).parse(await c.req.json())
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found')
    if (existing.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Admin cannot disable owner')
    }
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { status }, include: { managerProfile: true, supervisor: true } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), id, 'user', id, 'status_change', { from: existing.status, to: status }, auditActionSource(actor))
      return updated
    })
    return c.json({ user: userDto(user) })
  })

  routes.delete('/users/:id', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found')
    if (existing.role === 'OWNER') throw new AppError(403, 'FORBIDDEN', 'Owner cannot be removed')
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { status: 'DISABLED' }, include: { managerProfile: true, supervisor: true } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), id, 'user', id, 'status_change', { from: existing.status, to: 'DISABLED' }, auditActionSource(actor))
      return updated
    })
    return c.json({ user: userDto(user) })
  })

  routes.get('/managers', requirePermission('users:manage'), async (c) => {
    const managers = await db.user.findMany({
      where: { role: { in: ['MANAGER', 'SUPERVISOR'] } },
      include: { managerProfile: true, supervisor: true },
      orderBy: { displayName: 'asc' },
    })
    return c.json({ managers: managers.map(userDto) })
  })

  routes.get('/managers/:id', requirePermission('metrics:view'), async (c) => {
    const manager = await getVisibleManager(db, c.req.param('id'), c.var.user)
    return c.json({ manager: userDto(manager) })
  })

  routes.patch('/managers/:id/profile', requirePermission('users:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const input = managerProfileSchema.parse(await c.req.json())
    const profile = await db.$transaction(async (tx) => {
      const saved = await tx.managerProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...input },
        update: input,
      })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), id, 'manager_profile', id, 'manager_update', input, auditActionSource(actor))
      return saved
    })
    return c.json({ profile })
  })

  routes.get('/managers/:id/metrics', requirePermission('metrics:view'), async (c) => {
    await getVisibleManager(db, c.req.param('id'), c.var.user)
    return c.json(await metricsForManager(db, c.req.param('id'), dateRangeFromQuery(c.req.query('from'), c.req.query('to'))))
  })

  routes.get('/functions', requirePermission('functions:manage'), async (c) => {
    const functions = await db.functionSetting.findMany({ orderBy: { key: 'asc' } })
    return c.json({ functions: functions.map(functionDto) })
  })

  routes.patch('/functions/:key', requirePermission('functions:manage'), async (c) => {
    const actor = c.var.user
    const key = c.req.param('key')
    const input = functionPatchSchema.parse(await c.req.json())
    const setting = await db.$transaction(async (tx) => {
      const saved = await tx.functionSetting.upsert({
        where: { key },
        create: {
          key,
          title: input.title ?? key,
          description: input.description ?? null,
          valueJson: input.valueJson ?? {},
          enabled: input.enabled ?? true,
          updatedBy: actor.id,
        },
        update: { ...input, valueJson: input.valueJson as Prisma.InputJsonValue | undefined, updatedBy: actor.id },
      })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), null, 'function_setting', key, 'function_update', input, auditActionSource(actor))
      return saved
    })
    return c.json({ function: functionDto(setting) })
  })

  routes.get('/scripts', requirePermission('scripts:manage'), async (c) => {
    const scripts = await db.salesScript.findMany({ orderBy: { updatedAt: 'desc' } })
    return c.json({ scripts: scripts.map(scriptDto) })
  })

  routes.post('/scripts', requirePermission('scripts:manage'), async (c) => {
    const actor = c.var.user
    const input = scriptCreateSchema.parse(await c.req.json())
    const script = await db.$transaction(async (tx) => {
      const saved = await tx.salesScript.create({ data: { ...input, updatedBy: actor.id } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), null, 'sales_script', saved.id, 'script_update', input, auditActionSource(actor))
      return saved
    })
    return c.json({ script: scriptDto(script) }, 201)
  })

  routes.patch('/scripts/:id', requirePermission('scripts:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const input = scriptPatchSchema.parse(await c.req.json())
    const script = await db.$transaction(async (tx) => {
      const saved = await tx.salesScript.update({ where: { id }, data: { ...input, updatedBy: actor.id } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), null, 'sales_script', id, 'script_update', input, auditActionSource(actor))
      return saved
    })
    return c.json({ script: scriptDto(script) })
  })

  routes.delete('/scripts/:id', requirePermission('scripts:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const script = await db.$transaction(async (tx) => {
      const saved = await tx.salesScript.update({ where: { id }, data: { enabled: false, updatedBy: actor.id } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), null, 'sales_script', id, 'script_update', { enabled: false }, auditActionSource(actor))
      return saved
    })
    return c.json({ script: scriptDto(script) })
  })

  routes.get('/metrics/overview', requirePermission('metrics:view'), async (c) => c.json(await metricsOverview(db, dateRangeFromQuery(c.req.query('from'), c.req.query('to')))))
  routes.get('/metrics/managers', requirePermission('metrics:view'), async (c) => c.json(await managerLeaderboard(db, dateRangeFromQuery(c.req.query('from'), c.req.query('to')))))
  routes.get('/metrics/managers/:id', requirePermission('metrics:view'), async (c) => {
    await getVisibleManager(db, c.req.param('id'), c.var.user)
    return c.json(await metricsForManager(db, c.req.param('id'), dateRangeFromQuery(c.req.query('from'), c.req.query('to'))))
  })
  routes.post('/metrics/manual-entry', requirePermission('metrics:view'), async (c) => {
    const actor = c.var.user
    const input = manualMetricEntrySchema.parse(await c.req.json())
    const manager = await db.user.findUnique({ where: { id: input.managerId } })
    if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found')
    const date = new Date(`${input.date}T00:00:00.000Z`)
    const metric = await db.$transaction(async (tx) => {
      const existing = await tx.managerDailyMetric.findUnique({
        where: { managerId_date: { managerId: input.managerId, date } },
      })
      const data = metricUpdateData(input, existing)
      const saved = await tx.managerDailyMetric.upsert({
        where: { managerId_date: { managerId: input.managerId, date } },
        create: {
          managerId: input.managerId,
          date,
          ...data,
          source: input.source,
          note: input.note,
        },
        update: {
          ...data,
          source: input.source,
          note: input.note,
        },
      })
      await tx.activityLog.create({
        data: {
          actorUserId: actor.realUserId ?? actor.id,
          effectiveUserId: actor.effectiveUserId ?? actor.id,
          targetUserId: input.managerId,
          entityType: 'manager_daily_metric',
          entityId: saved.id,
          action: 'manual_metric_entry',
          actionSource: input.source,
          payloadJson: input,
        },
      })
      return saved
    })
    return c.json({ metric: metricDto(metric) })
  })

  routes.get('/activity-log', requireRole(['OWNER', 'ADMIN']), async (c) => {
    const logs = await db.activityLog.findMany({
      include: { actor: true, target: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return c.json({ logs: logs.map(activityDto) })
  })

  return routes
}

export function createLeadRoutes(db: DbClient) {
  const routes = new Hono<AuthenticatedHonoEnv>()
  routes.use('*', requireAuth)

  routes.get('/', requirePermission('leads:view'), async (c) => {
    const actor = c.var.user
    const deals = await db.deal.findMany({
      where: leadVisibilityWhere(actor),
      include: { assignedManager: true, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return c.json({ leads: deals.map(dealDto) })
  })

  routes.post('/', requirePermission('leads:manage'), async (c) => {
    const actor = c.var.user
    const input = dealCreateSchema.parse(await c.req.json())
    const deal = await db.deal.create({
      data: {
        ...input,
        createdBy: actor.id,
        assignedManagerId: input.assignedManagerId ?? (actor.role === 'MANAGER' ? actor.id : undefined),
      },
      include: { assignedManager: true, creator: true },
    })
    return c.json({ lead: dealDto(deal) }, 201)
  })

  routes.patch('/:id', requirePermission('leads:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    await assertCanAccessLead(db, id, actor)
    const input = dealPatchSchema.parse(await c.req.json())
    const deal = await db.deal.update({ where: { id }, data: input, include: { assignedManager: true, creator: true } })
    return c.json({ lead: dealDto(deal) })
  })

  routes.patch('/:id/assign', requirePermission('leads:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const { assignedManagerId } = z.object({ assignedManagerId: z.string().uuid().nullable() }).parse(await c.req.json())
    await assertCanAccessLead(db, id, actor)
    const deal = await db.$transaction(async (tx) => {
      const saved = await tx.deal.update({ where: { id }, data: { assignedManagerId }, include: { assignedManager: true, creator: true } })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), assignedManagerId, 'deal', id, 'lead_assignment', { assignedManagerId }, auditActionSource(actor))
      return saved
    })
    return c.json({ lead: dealDto(deal) })
  })

  routes.patch('/:id/status', requirePermission('leads:manage'), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')
    const { status } = z.object({ status: dealCreateSchema.shape.status }).parse(await c.req.json())
    await assertCanAccessLead(db, id, actor)
    const deal = await db.$transaction(async (tx) => {
      const saved = await tx.deal.update({
        where: { id },
        data: { status, closedAt: status === 'SUCCESS' || status === 'CANCELLED' ? new Date() : null },
        include: { assignedManager: true, creator: true },
      })
      await writeActivity(tx, auditActorId(actor), auditEffectiveUserId(actor), saved.assignedManagerId, 'deal', id, 'lead_status_change', { status }, auditActionSource(actor))
      return saved
    })
    return c.json({ lead: dealDto(deal) })
  })

  return routes
}

function assertCanChangeOwner(actorRole: Role, nextRole: Role) {
  if (nextRole === 'OWNER' && actorRole !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only owner can grant owner role')
  }
}

function userPatchInput(input: z.infer<typeof userPatchSchema>) {
  const displayName = input.displayName ?? ([input.firstName, input.lastName].filter(Boolean).join(' ') || input.username)
  return {
    displayName,
    role: input.role,
    status: input.status,
    telegramId: input.telegramId,
    telegramUsername: input.username,
    telegramFirstName: input.firstName,
    telegramLastName: input.lastName,
    supervisorId: input.supervisorId,
  }
}

function leadVisibilityWhere(actor: { id: string; role: string }) {
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') return {}
  if (actor.role === 'SUPERVISOR') return { assignedManager: { supervisorId: actor.id } }
  return { assignedManagerId: actor.id }
}

async function assertCanAccessLead(db: DbClient, id: string, actor: { id: string; role: string }) {
  const deal = await db.deal.findFirst({ where: { id, ...leadVisibilityWhere(actor) } })
  if (!deal) throw new AppError(404, 'NOT_FOUND', 'Lead not found')
}

async function getVisibleManager(db: DbClient, id: string, actor: { id: string; role: string }) {
  const manager = await db.user.findFirst({
    where: {
      id,
      ...(actor.role === 'SUPERVISOR' ? { supervisorId: actor.id } : {}),
      ...(actor.role === 'MANAGER' ? { id: actor.id } : {}),
    },
    include: { managerProfile: true, supervisor: true },
  })
  if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found')
  return manager
}

async function metricsOverview(db: DbClient, range: DateRange) {
  const [managerCount, activeManagerCount, metricAggregate, successDeals, cancelledDeals, totalAmount] = await Promise.all([
    db.user.count({ where: { role: 'MANAGER' } }),
    db.user.count({ where: { role: 'MANAGER', status: 'ACTIVE' } }),
    db.managerDailyMetric.aggregate({
      where: { date: range },
      _sum: { leadsNew: true, leadsTaken: true, dealsSuccess: true, dealsCancelled: true, messagesCount: true },
      _avg: { avgResponseSeconds: true, conversionRate: true },
    }),
    db.deal.count({ where: { status: 'SUCCESS', updatedAt: range } }),
    db.deal.count({ where: { status: 'CANCELLED', updatedAt: range } }),
    db.deal.aggregate({ where: { status: 'SUCCESS', updatedAt: range }, _sum: { amount: true } }),
  ])
  return {
    metrics: {
      totalManagers: managerCount,
      activeManagers: activeManagerCount,
      leadsToday: metricAggregate._sum.leadsNew ?? 0,
      successfulDealsToday: metricAggregate._sum.dealsSuccess ?? successDeals,
      cancelledDealsToday: metricAggregate._sum.dealsCancelled ?? cancelledDeals,
      totalAmountToday: Number(totalAmount._sum.amount ?? 0),
      conversionRate: Number(metricAggregate._avg.conversionRate ?? 0),
      averageResponseSeconds: Math.round(metricAggregate._avg.avgResponseSeconds ?? 0),
      messagesCount: metricAggregate._sum.messagesCount ?? 0,
    },
  }
}

async function managerLeaderboard(db: DbClient, range: DateRange) {
  const metrics = await db.managerDailyMetric.groupBy({
    by: ['managerId'],
    where: { date: range },
    _sum: { leadsNew: true, dealsSuccess: true, dealsCancelled: true, totalAmount: true },
    _avg: { conversionRate: true, avgResponseSeconds: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
  })
  const managers = await db.user.findMany({ where: { id: { in: metrics.map((metric) => metric.managerId) } }, include: { managerProfile: true } })
  const managerById = new Map(managers.map((manager) => [manager.id, manager]))
  return {
    managers: metrics.map((metric) => ({
      manager: userDto(managerById.get(metric.managerId)),
      leadsNew: metric._sum.leadsNew ?? 0,
      dealsSuccess: metric._sum.dealsSuccess ?? 0,
      dealsCancelled: metric._sum.dealsCancelled ?? 0,
      totalAmount: Number(metric._sum.totalAmount ?? 0),
      conversionRate: Number(metric._avg.conversionRate ?? 0),
      averageResponseSeconds: Math.round(metric._avg.avgResponseSeconds ?? 0),
    })),
  }
}

async function metricsForManager(db: DbClient, managerId: string, range: DateRange) {
  const rows = await db.managerDailyMetric.findMany({ where: { managerId, date: range }, orderBy: { date: 'asc' } })
  return { metrics: rows.map(metricDto) }
}

type DateRange = { gte: Date; lte: Date }

function dateRangeFromQuery(from?: string, to?: string): DateRange {
  const now = new Date()
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = to ? new Date(to) : new Date(start)
  if (!to) end.setHours(23, 59, 59, 999)
  return { gte: start, lte: end }
}

function auditActorId(actor: { id: string; realUserId?: string }) {
  return actor.realUserId ?? actor.id
}

function auditEffectiveUserId(actor: { id: string; effectiveUserId?: string }) {
  return actor.effectiveUserId ?? actor.id
}

function auditActionSource(actor: { ownerMode?: string | null }) {
  if (actor.ownerMode === 'ROLE_PREVIEW') return 'owner_preview'
  if (actor.ownerMode === 'USER_IMPERSONATION') return 'owner_impersonation'
  return 'mini_app'
}

async function writeActivity(
  tx: any,
  actorUserId: string,
  effectiveUserId: string,
  targetUserId: string | null,
  entityType: string,
  entityId: string,
  action: string,
  payloadJson: unknown,
  actionSource: string,
) {
  await tx.activityLog.create({
    data: {
      actorUserId,
      effectiveUserId,
      targetUserId,
      entityType,
      entityId,
      action,
      actionSource,
      payloadJson: payloadJson ?? {},
    },
  })
}

function telegramEmail(telegramId: string) {
  return `telegram-${telegramId}@telegram.rolf-sales-rep-mvp.local`
}

function userDto(user: any) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role === 'SALES_REP' ? 'MANAGER' : user.role,
    status: user.status,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    telegramFirstName: user.telegramFirstName,
    telegramLastName: user.telegramLastName,
    telegramPhotoUrl: user.telegramPhotoUrl,
    supervisorId: user.supervisorId,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    managerProfile: user.managerProfile ?? null,
    supervisor: user.supervisor ? { id: user.supervisor.id, displayName: user.supervisor.displayName } : null,
  }
}

function functionDto(setting: any) {
  return { ...setting, updatedAt: setting.updatedAt.toISOString() }
}

function scriptDto(script: any) {
  return { ...script, updatedAt: script.updatedAt.toISOString() }
}

function dealDto(deal: any) {
  return {
    ...deal,
    amount: Number(deal.amount),
    assignedManager: userDto(deal.assignedManager),
    creator: userDto(deal.creator),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    closedAt: deal.closedAt?.toISOString() ?? null,
  }
}

function metricUpdateData(input: z.infer<typeof manualMetricEntrySchema>, existing: any) {
  const add = input.mode === 'add'
  const current = existing ?? {}
  const next = {
    leadsNew: metricNumber(input.leadsNew, current.leadsNew, add),
    leadsTaken: metricNumber(input.leadsTaken, current.leadsTaken, add),
    dealsSuccess: metricNumber(input.dealsSuccess, current.dealsSuccess, add),
    dealsCancelled: metricNumber(input.dealsCancelled, current.dealsCancelled, add),
    totalAmount: metricNumber(input.totalAmount, Number(current.totalAmount ?? 0), add),
    avgResponseSeconds: metricNumber(input.avgResponseSeconds, current.avgResponseSeconds, add),
    messagesCount: metricNumber(input.messagesCount, current.messagesCount, add),
  }
  const totalClosed = next.dealsSuccess + next.dealsCancelled
  return {
    ...next,
    conversionRate: totalClosed > 0 ? Math.round((next.dealsSuccess / totalClosed) * 10000) / 100 : 0,
  }
}

function metricNumber(value: number | undefined, current: number | undefined, add: boolean) {
  if (value === undefined) return current ?? 0
  return add ? (current ?? 0) + value : value
}

function metricDto(metric: any) {
  return {
    ...metric,
    date: metric.date.toISOString().slice(0, 10),
    totalAmount: Number(metric.totalAmount),
    conversionRate: Number(metric.conversionRate),
  }
}

function activityDto(log: any) {
  return {
    ...log,
    actor: userDto(log.actor),
    target: userDto(log.target),
    createdAt: log.createdAt.toISOString(),
  }
}
