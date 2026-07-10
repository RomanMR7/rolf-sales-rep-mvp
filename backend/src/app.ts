import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { createAdminRoutes, createLeadRoutes } from './admin/routes'
import { createAuthRoutes } from './auth/routes'
import { requireAuth } from './auth/middleware'
import { AuthService } from './auth/service'
import { createBusinessRoutes } from './business/routes'
import type { AppHonoEnv } from './http/context'
import { userDtoFromAuthenticatedUser } from './http/context'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createStorageServiceFromEnv } from './storage/service'
import { telegramWebhookReplyForUpdate } from './telegram/bot'

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const authService = new AuthService(prisma, env)
  const storageService = createStorageServiceFromEnv(env)
  const app = new OpenAPIHono<AppHonoEnv>({
    defaultHook: validationErrorHook,
  })

  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  app.use('*', async (c, next) => {
    c.set('authService', authService)
    c.set('env', env)
    c.set('storageService', storageService)
    await next()
  })

  app.get('/', (c) => {
    return c.json({
      name: 'rolf_sales_rep_mvp backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  const authRoutes = createAuthRoutes()
  app.route('/api/auth', authRoutes)
  app.route('/auth', authRoutes)
  app.get('/me', requireAuth, (c) => {
    return c.json({ user: userDtoFromAuthenticatedUser(c.var.user) }, 200)
  })
  app.get('/telegram/config', (c) => telegramConfig(c.get('env')))
  app.get('/api/telegram/config', (c) => telegramConfig(c.get('env')))
  app.post('/telegram/webhook', async (c) => {
    const update = await c.req.json().catch(() => ({}))
    return c.json(telegramWebhookReplyForUpdate(update, c.get('env')), 200)
  })
  app.post('/api/telegram/webhook', async (c) => {
    const update = await c.req.json().catch(() => ({}))
    return c.json(telegramWebhookReplyForUpdate(update, c.get('env')), 200)
  })
  app.route('/api/admin', createAdminRoutes(prisma))
  app.route('/api/leads', createLeadRoutes(prisma))
  app.route('/leads', createLeadRoutes(prisma))
  app.route('/api', createBusinessRoutes(prisma))

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'rolf_sales_rep_mvp API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

function telegramConfig(env: AppEnv) {
  const username = env.TELEGRAM_BOT_USERNAME ?? null
  const webAppUrl = env.TELEGRAM_WEBAPP_URL ?? null
  return new Response(JSON.stringify({
    botUsername: username,
    webAppUrl,
    startCommand: '/start',
    menuButtonUrl: webAppUrl,
    directLink: username ? `https://t.me/${username}?startapp` : null,
    webhookUrl: env.BACKEND_PUBLIC_URL ? `${env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')}/telegram/webhook` : null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type AppType = ReturnType<typeof createApp>
