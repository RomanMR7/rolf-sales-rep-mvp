import { createMiddleware } from 'hono/factory'

import type { AuthenticatedHonoEnv } from '../http/context'
import { AppError } from '../http/errors'

export type Role = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER' | 'VIEWER'
export type Permission =
  | 'users:manage'
  | 'functions:manage'
  | 'scripts:manage'
  | 'metrics:view'
  | 'leads:manage'
  | 'leads:view'

export const rolePermissions: Record<Role, Permission[]> = {
  OWNER: ['users:manage', 'functions:manage', 'scripts:manage', 'metrics:view', 'leads:manage', 'leads:view'],
  ADMIN: ['users:manage', 'functions:manage', 'scripts:manage', 'metrics:view', 'leads:manage', 'leads:view'],
  SUPERVISOR: ['metrics:view', 'leads:view'],
  MANAGER: ['leads:manage', 'leads:view', 'metrics:view'],
  VIEWER: ['metrics:view'],
}

export function permissionsForRole(role: Role) {
  const permissions = rolePermissions[role] ?? []
  return {
    usersManage: permissions.includes('users:manage'),
    functionsManage: permissions.includes('functions:manage'),
    scriptsManage: permissions.includes('scripts:manage'),
    metricsView: permissions.includes('metrics:view'),
    leadsManage: permissions.includes('leads:manage'),
    leadsView: permissions.includes('leads:view'),
  }
}

export function navigationForRole(role: Role) {
  const permissions = permissionsForRole(role)
  return {
    owner: role === 'OWNER',
    dashboard: true,
    leads: permissions.leadsView,
    managers: permissions.usersManage || role === 'SUPERVISOR',
    metrics: permissions.metricsView,
    functions: permissions.functionsManage,
    scripts: permissions.scriptsManage,
    settings: true,
  }
}

export const requireAuth = createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
  const accessToken = bearerToken(c.req.header('authorization'))
  const user = await c.var.authService.authenticateAccessToken(accessToken)
  c.set('user', user)

  await next()
})

export function requireRole(roles: Role[]) {
  return createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
    if (!roles.includes(c.var.user.effectiveRole as Role)) {
      throw new AppError(403, 'FORBIDDEN', 'Required role is missing')
    }

    await next()
  })
}

export function requirePermission(permission: Permission) {
  return createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
    const permissions = rolePermissions[c.var.user.effectiveRole as Role] ?? []
    if (!permissions.includes(permission)) {
      throw new AppError(403, 'FORBIDDEN', 'Required permission is missing')
    }

    await next()
  })
}

function bearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}
