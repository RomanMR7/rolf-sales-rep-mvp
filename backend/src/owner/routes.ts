import { Hono } from 'hono'
import { z } from 'zod'

import { requireAuth } from '../auth/middleware'
import type { DbClient } from '../db'
import type { AuthenticatedHonoEnv } from '../http/context'
import { AppError } from '../http/errors'

const roleSchema = z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'])

export function createOwnerRoutes(db: DbClient) {
  const routes = new Hono<AuthenticatedHonoEnv>()
  routes.use('*', requireAuth)
  routes.use('*', async (c, next) => {
    if (c.var.user.realRole !== 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Только владелец может использовать режим владельца')
    }
    await next()
  })

  routes.get('/effective-session', async (c) => {
    return c.json({ effectiveSession: c.var.user.effectiveSession })
  })

  routes.post('/preview-role', async (c) => {
    const { role } = z.object({ role: roleSchema }).parse(await c.req.json())
    await db.$transaction(async (tx) => {
      await tx.authSession.update({
        where: { id: c.var.user.sessionId },
        data: {
          ownerMode: 'ROLE_PREVIEW',
          effectiveRole: role,
          effectiveUserId: null,
        },
      })
      await tx.activityLog.create({
        data: {
          actorUserId: c.var.user.realUserId,
          effectiveUserId: c.var.user.realUserId,
          targetUserId: c.var.user.realUserId,
          entityType: 'auth_session',
          entityId: c.var.user.sessionId,
          action: 'owner_preview_role',
          actionSource: 'owner_preview',
          payloadJson: { role },
        },
      })
    })

    return c.json({ ok: true, mode: 'ROLE_PREVIEW', role })
  })

  routes.post('/impersonate', async (c) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(await c.req.json())
    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Пользователь не найден')
    if (target.role === 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Нельзя работать как другой владелец')
    }

    await db.$transaction(async (tx) => {
      await tx.authSession.update({
        where: { id: c.var.user.sessionId },
        data: {
          ownerMode: 'USER_IMPERSONATION',
          effectiveUserId: target.id,
          effectiveRole: target.role,
        },
      })
      await tx.activityLog.create({
        data: {
          actorUserId: c.var.user.realUserId,
          effectiveUserId: target.id,
          targetUserId: target.id,
          entityType: 'auth_session',
          entityId: c.var.user.sessionId,
          action: 'owner_impersonation_start',
          actionSource: 'owner_impersonation',
          payloadJson: { userId: target.id, role: target.role },
        },
      })
    })

    return c.json({ ok: true, mode: 'USER_IMPERSONATION', userId: target.id })
  })

  routes.post('/impersonation/stop', async (c) => {
    await db.$transaction(async (tx) => {
      await tx.authSession.update({
        where: { id: c.var.user.sessionId },
        data: {
          ownerMode: null,
          effectiveRole: null,
          effectiveUserId: null,
        },
      })
      await tx.activityLog.create({
        data: {
          actorUserId: c.var.user.realUserId,
          effectiveUserId: c.var.user.effectiveUserId,
          targetUserId: c.var.user.effectiveUserId === c.var.user.realUserId ? null : c.var.user.effectiveUserId,
          entityType: 'auth_session',
          entityId: c.var.user.sessionId,
          action: 'owner_impersonation_stop',
          actionSource: c.var.user.ownerMode === 'ROLE_PREVIEW' ? 'owner_preview' : 'owner_impersonation',
          payloadJson: { previousMode: c.var.user.ownerMode },
        },
      })
    })

    return c.json({ ok: true })
  })

  return routes
}
