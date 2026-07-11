import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { createAdminRoutes, createLeadRoutes } from './admin/routes'
import { createAuthRoutes } from './auth/routes'
import { requireAuth } from './auth/middleware'
import { AuthService, mePayload } from './auth/service'
import { createBusinessRoutes } from './business/routes'
import type { AppHonoEnv } from './http/context'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createOwnerRoutes } from './owner/routes'
import { createStorageServiceFromEnv } from './storage/service'
import { telegramWebhookReplyForUpdateWithDb } from './telegram/bot'
import { sendTelegramWebhookReply } from './telegram/send'
import { telegramWebhookUrl } from './telegram/webhookSetup'

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
    return c.json(mePayload(c.var.user), 200)
  })
  app.get('/api/app/bootstrap', requireAuth, async (c) => {
    const user = c.var.user
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const [urgentLeads, activeManagers, metrics] = await Promise.all([
      prisma.deal.count({ where: { assignedManagerId: null, status: { in: ['NEW', 'TAKEN'] } } }),
      prisma.user.count({ where: { role: { in: ['MANAGER', 'SUPERVISOR'] }, status: 'ACTIVE' } }),
      user.permissions.metricsView
        ? prisma.managerDailyMetric.aggregate({
            where: { date: { gte: todayStart } },
            _sum: { leadsNew: true, dealsSuccess: true, dealsCancelled: true, totalAmount: true },
            _avg: { conversionRate: true },
          })
        : Promise.resolve(null),
    ])
    return c.json({
      ...mePayload(user),
      featureFlags: {
        owner_notifications_enabled: true,
        admin_notifications_enabled: true,
        lead_notifications_enabled: true,
        metric_alerts_enabled: true,
      },
      counters: {
        urgentLeads,
        activeManagers,
      },
      dashboardSummary: {
        leadsToday: metrics?._sum.leadsNew ?? 0,
        dealsSuccessToday: metrics?._sum.dealsSuccess ?? 0,
        dealsCancelledToday: metrics?._sum.dealsCancelled ?? 0,
        totalAmountToday: Number(metrics?._sum.totalAmount ?? 0),
        conversionRate: Number(metrics?._avg.conversionRate ?? 0),
      },
    })
  })
  app.get('/telegram/config', (c) => telegramConfig(c.get('env')))
  app.get('/api/telegram/config', (c) => telegramConfig(c.get('env')))
  app.post('/telegram/webhook', async (c) => {
    const update = await c.req.json().catch(() => ({}))
    const reply = await telegramWebhookReplyForUpdateWithDb(update, c.get('env'), prisma)
    if (await sendTelegramWebhookReply(c.get('env'), reply)) return c.json({ ok: true }, 200)
    return c.json(reply, 200)
  })
  app.post('/api/telegram/webhook', async (c) => {
    const update = await c.req.json().catch(() => ({}))
    const reply = await telegramWebhookReplyForUpdateWithDb(update, c.get('env'), prisma)
    if (await sendTelegramWebhookReply(c.get('env'), reply)) return c.json({ ok: true }, 200)
    return c.json(reply, 200)
  })
  app.route('/api/admin', createAdminRoutes(prisma))
  app.route('/api/owner', createOwnerRoutes(prisma))
  app.route('/owner', createOwnerRoutes(prisma))
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
    webhookUrl: telegramWebhookUrl(env),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type AppType = ReturnType<typeof createApp>
