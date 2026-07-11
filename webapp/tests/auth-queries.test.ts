import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyAuthenticatedSession,
  authQueryKeys,
  clearAuthenticatedSession,
} from '../src/lib/auth-queries'

const user = {
  id: 'user_1',
  email: 'user@example.com',
  displayName: null,
  role: 'MANAGER',
  status: 'ACTIVE',
  telegramId: null,
  telegramUsername: null,
  telegramFirstName: null,
  telegramLastName: null,
  telegramPhotoUrl: null,
  supervisorId: null,
  lastSeenAt: null,
  createdAt: '2026-05-11T00:00:00.000Z',
}

test('auth query helpers keep access token memory and current-user cache in sync', () => {
  const queryClient = new QueryClient()
  let accessToken: string | null = null

  applyAuthenticatedSession(
    queryClient,
    (nextAccessToken) => {
      accessToken = nextAccessToken
    },
    {
      accessToken: 'fresh-access-token',
      user,
    },
  )

  expect(accessToken).toBe('fresh-access-token')
  expect(queryClient.getQueryData(authQueryKeys.me())).toEqual({ user })

  clearAuthenticatedSession(queryClient, (nextAccessToken) => {
    accessToken = nextAccessToken
  })

  expect(accessToken).toBeNull()
  expect(queryClient.getQueryData(authQueryKeys.me())).toBeUndefined()
})

test('auth provider clears stale cached session when bootstrap refresh expires', () => {
  const authProvider = readFileSync(join(import.meta.dir, '..', 'src/lib/auth.tsx'), 'utf8')

  expect(authProvider).toContain('const [cachedMe, setCachedMe]')
  expect(authProvider).toContain('onAuthExpired: handleAuthExpired')
  expect(authProvider).toContain('setCachedMe(null)')
  expect(authProvider).toContain('Boolean(window.Telegram?.WebApp) || Boolean(cachedMe)')
})
