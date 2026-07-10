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

const rolePermissions: Record<Role, Permission[]> = {
  OWNER: ['users:manage', 'functions:manage', 'scripts:manage', 'metrics:view', 'leads:manage', 'leads:view'],
  ADMIN: ['users:manage', 'functions:manage', 'scripts:manage', 'metrics:view', 'leads:manage', 'leads:view'],
  SUPERVISOR: ['metrics:view', 'leads:view'],
  MANAGER: ['leads:manage', 'leads:view', 'metrics:view'],
  VIEWER: ['metrics:view'],
}

export const requireAuth = createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
  const accessToken = bearerToken(c.req.header('authorization'))
  const user = await c.var.authService.authenticateAccessToken(accessToken)
  c.set('user', user)

  await next()
})

export function requireRole(roles: Role[]) {
  return createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
    if (!roles.includes(c.var.user.role as Role)) {
      throw new AppError(403, 'FORBIDDEN', 'Required role is missing')
    }

    await next()
  })
}

export function requirePermission(permission: Permission) {
  return createMiddleware<AuthenticatedHonoEnv>(async (c, next) => {
    const permissions = rolePermissions[c.var.user.role as Role] ?? []
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
