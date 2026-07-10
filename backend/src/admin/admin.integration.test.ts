import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('admin API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    ADMIN_TELEGRAM_IDS: ['900001'],
    ALLOW_DEV_AUTH: false,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.activityLog.deleteMany()
    await prisma.managerDailyMetric.deleteMany()
    await prisma.deal.deleteMany()
    await prisma.managerProfile.deleteMany()
    await prisma.functionSetting.deleteMany()
    await prisma.salesScript.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('owner can manage users, functions, metrics, and audit log', async () => {
    const ownerToken = await registerAndPromoteOwner('owner@example.com')

    const createManager = await app.request('/api/admin/users', {
      method: 'POST',
      headers: jsonAuth(ownerToken),
      body: JSON.stringify({
        displayName: 'New Manager',
        telegramId: '700001',
        role: 'MANAGER',
        status: 'INVITED',
        profile: { displayName: 'New Manager', timezone: 'Asia/Dubai' },
      }),
    })
    const createManagerBody = await createManager.json()
    expect(createManager.status).toBe(201)
    expect(createManagerBody.user.role).toBe('MANAGER')

    const setting = await app.request('/api/admin/functions/lead_auto_assign', {
      method: 'PATCH',
      headers: jsonAuth(ownerToken),
      body: JSON.stringify({
        title: 'Lead auto assignment',
        description: 'Round robin manager assignment',
        valueJson: { mode: 'round_robin' },
        enabled: true,
      }),
    })
    expect(setting.status).toBe(200)

    await prisma.managerDailyMetric.create({
      data: {
        managerId: createManagerBody.user.id,
        date: new Date(),
        leadsNew: 4,
        dealsSuccess: 2,
        totalAmount: 1200,
        conversionRate: 50,
      },
    })

    const metrics = await app.request('/api/admin/metrics/overview', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const metricsBody = await metrics.json()
    expect(metrics.status).toBe(200)
    expect(metricsBody.metrics.totalManagers).toBe(1)
    expect(metricsBody.metrics.leadsToday).toBe(4)

    const roleChange = await app.request(`/api/admin/users/${createManagerBody.user.id}/role`, {
      method: 'PATCH',
      headers: jsonAuth(ownerToken),
      body: JSON.stringify({ role: 'SUPERVISOR' }),
    })
    expect(roleChange.status).toBe(200)

    const log = await app.request('/api/admin/activity-log', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const logBody = await log.json()
    expect(log.status).toBe(200)
    expect(logBody.logs.map((entry: { action: string }) => entry.action)).toContain('role_change')
    expect(logBody.logs.map((entry: { action: string }) => entry.action)).toContain('function_update')
  })

  test('viewer cannot use admin management endpoints', async () => {
    const viewerToken = await register('viewer@example.com')

    const response = await app.request('/api/admin/users', {
      headers: { Authorization: `Bearer ${viewerToken}` },
    })

    expect(response.status).toBe(403)
  })

  async function registerAndPromoteOwner(email: string) {
    const accessToken = await register(email)
    await prisma.user.update({
      where: { email },
      data: { role: 'OWNER', status: 'ACTIVE' },
    })
    return accessToken
  }

  async function register(email: string) {
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    const body = await response.json()
    expect(response.status).toBe(201)
    return body.accessToken as string
  }
})

function jsonAuth(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }
}
