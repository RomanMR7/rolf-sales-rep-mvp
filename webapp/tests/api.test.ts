import { afterEach, expect, test } from 'bun:test'

import { ApiClient } from '../src/lib/api'
import { productionApiFallbackUrl, resolveApiBaseUrls } from '../src/lib/apiConfig'
import { bootstrapAuthSession } from '../src/lib/bootstrap-auth'

const originalFetch = globalThis.fetch
const apiBaseUrl = 'https://api.test'
const user = {
  id: 'user_1',
  email: 'user@example.com',
  displayName: null,
  role: 'SALES_REP',
  telegramId: null,
  telegramUsername: null,
  telegramFirstName: null,
  telegramLastName: null,
  createdAt: '2026-05-11T00:00:00.000Z',
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('API config uses Render fallback when VITE_API_URL is missing or invalid', () => {
  expect(resolveApiBaseUrls(undefined).urls).toEqual([productionApiFallbackUrl])
  expect(resolveApiBaseUrls('').urls).toEqual([productionApiFallbackUrl])
  expect(resolveApiBaseUrls('not-a-url').urls).toEqual([productionApiFallbackUrl])
})

test('API config normalizes trailing slashes and keeps fallback as secondary base', () => {
  expect(resolveApiBaseUrls('https://primary.example.com///').urls).toEqual([
    'https://primary.example.com',
    productionApiFallbackUrl,
  ])
})

test('ApiClient retries the production fallback when the first API base has a network error', async () => {
  const calls: string[] = []

  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)

    if (url.startsWith('https://broken.example.com')) {
      throw new TypeError('Failed to fetch')
    }

    return json(
      {
        user,
        accessToken: 'fallback-access-token',
      },
      200,
    )
  }

  const client = new ApiClient({
    apiBaseUrl: 'https://broken.example.com/',
    fallbackApiBaseUrl: productionApiFallbackUrl,
    getAccessToken: () => null,
    setAccessToken: () => undefined,
  })

  const response = await client.login({
    email: 'rep1@rolf-demo.local',
    password: 'DemoPass123!',
  })

  expect(response.accessToken).toBe('fallback-access-token')
  expect(calls).toEqual([
    'https://broken.example.com/api/auth/login',
    `${productionApiFallbackUrl}/api/auth/login`,
  ])
})

test('ApiClient reports checked API bases when all network attempts fail', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }

  const client = new ApiClient({
    apiBaseUrl: 'https://broken.example.com/',
    fallbackApiBaseUrl: productionApiFallbackUrl,
    getAccessToken: () => null,
    setAccessToken: () => undefined,
  })

  await expect(
    client.login({
      email: 'rep1@rolf-demo.local',
      password: 'DemoPass123!',
    }),
  ).rejects.toMatchObject({
    status: 0,
    code: 'BACKEND_UNREACHABLE',
    message: `Backend is unreachable. Checked: https://broken.example.com, ${productionApiFallbackUrl}`,
  })
})

test('ApiClient login uses the resolved base URL without duplicate slashes', async () => {
  const calls: string[] = []

  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return json(
      {
        user,
        accessToken: 'login-access-token',
      },
      200,
    )
  }

  const client = new ApiClient({
    apiBaseUrl: 'https://api.test/',
    getAccessToken: () => null,
    setAccessToken: () => undefined,
  })

  await client.login({
    email: 'rep1@rolf-demo.local',
    password: 'DemoPass123!',
  })

  expect(calls).toEqual(['https://api.test/api/auth/login'])
})

test('ApiClient refreshes and retries authenticated requests with the new access token', async () => {
  let accessToken: string | null = 'expired-access-token'
  const calls: Array<{ path: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const path = new URL(url).pathname
    const headers = new Headers(init?.headers)
    calls.push({ path, authorization: headers.get('Authorization') })

    const meCallCount = calls.filter((call) => call.path === '/api/auth/me').length

    if (path === '/api/auth/me' && meCallCount === 1) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired access token' } }, 401)
    }

    if (path === '/api/auth/refresh') {
      return json({ accessToken: 'fresh-access-token' }, 200)
    }

    if (path === '/api/auth/me') {
      return json(
        {
          user,
        },
        200,
      )
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    apiBaseUrl,
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const response = await client.me()
  const meCalls = calls.filter((call) => call.path === '/api/auth/me')

  expect(response.user.email).toBe('user@example.com')
  expect(meCalls).toHaveLength(2)
  expect(meCalls[0]?.authorization).toBe('Bearer expired-access-token')
  expect(meCalls[1]?.authorization).toBe('Bearer fresh-access-token')
})

test('ApiClient shares one refresh across concurrent unauthorized requests', async () => {
  let accessToken: string | null = 'expired-access-token'
  const calls: Array<{ path: string; authorization: string | null; credentials: RequestCredentials | undefined }> = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const path = new URL(url).pathname
    const headers = new Headers(init?.headers)
    const authorization = headers.get('Authorization')
    calls.push({ path, authorization, credentials: init?.credentials })

    if (path === '/api/auth/refresh') {
      await new Promise((resolve) => setTimeout(resolve, 0))
      return json({ accessToken: 'fresh-access-token' }, 200)
    }

    if (path === '/api/auth/me' && authorization === 'Bearer fresh-access-token') {
      return json(
        {
          user,
        },
        200,
      )
    }

    if (path === '/api/auth/me') {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired access token' } }, 401)
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    apiBaseUrl,
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
  })

  const [first, second] = await Promise.all([client.me(), client.me()])
  const refreshCalls = calls.filter((call) => call.path === '/api/auth/refresh')
  const meCalls = calls.filter((call) => call.path === '/api/auth/me')

  expect(first.user.email).toBe('user@example.com')
  expect(second.user.email).toBe('user@example.com')
  expect(refreshCalls).toHaveLength(1)
  expect(meCalls).toHaveLength(4)
  expect(meCalls.filter((call) => call.authorization === 'Bearer expired-access-token')).toHaveLength(2)
  expect(meCalls.filter((call) => call.authorization === 'Bearer fresh-access-token')).toHaveLength(2)
  expect(calls.every((call) => call.credentials === 'include')).toBe(true)
})

test('ApiClient clears session when refresh fails during an authenticated request', async () => {
  let accessToken: string | null = 'expired-access-token'
  let authExpiredCalls = 0
  const calls: Array<{ path: string; authorization: string | null }> = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const path = new URL(url).pathname
    const headers = new Headers(init?.headers)
    calls.push({ path, authorization: headers.get('Authorization') })

    if (path === '/api/auth/me') {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Expired access token' } }, 401)
    }

    if (path === '/api/auth/refresh') {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }, 401)
    }

    if (path === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    apiBaseUrl,
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
    onAuthExpired: () => {
      authExpiredCalls += 1
    },
  })

  await expect(client.me()).rejects.toMatchObject({
    status: 401,
    code: 'UNAUTHORIZED',
  })

  expect(accessToken).toBeNull()
  expect(authExpiredCalls).toBe(1)
  expect(calls.map((call) => call.path)).toEqual([
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/auth/logout',
  ])
})

test('ApiClient preserves backend error status, code, and message', async () => {
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname

    if (path === '/api/auth/register') {
      return json(
        {
          error: {
            code: 'CONFLICT',
            message: 'User with this email already exists',
          },
        },
        409,
      )
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    apiBaseUrl,
    getAccessToken: () => null,
    setAccessToken: () => undefined,
  })

  await expect(
    client.register({
      email: 'dupe@example.com',
      password: 'password123',
    }),
  ).rejects.toMatchObject({
    status: 409,
    code: 'CONFLICT',
    message: 'User with this email already exists',
  })
})

test('ApiClient expireSession clears stale web session cookie through logout', async () => {
  let accessToken: string | null = 'stale-access-token'
  let authExpiredCalls = 0
  const calls: Array<{ path: string; method: string | undefined }> = []

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({ path, method: init?.method })

    if (path === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }

    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected request' } }, 404)
  }

  const client = new ApiClient({
    apiBaseUrl,
    getAccessToken: () => accessToken,
    setAccessToken: (nextAccessToken) => {
      accessToken = nextAccessToken
    },
    onAuthExpired: () => {
      authExpiredCalls += 1
    },
  })

  await client.expireSession()

  expect(accessToken).toBeNull()
  expect(authExpiredCalls).toBe(1)
  expect(calls).toEqual([{ path: '/api/auth/logout', method: 'POST' }])
})

test('bootstrapAuthSession waits for stale-cookie cleanup before completing', async () => {
  const events: string[] = []
  let completed = false
  let finishCleanup!: () => void
  const cleanupFinished = new Promise<void>((resolve) => {
    finishCleanup = resolve
  })

  const bootstrap = bootstrapAuthSession({
    api: {
      refresh: async () => {
        events.push('refresh')
        throw new Error('Invalid refresh token')
      },
      expireSession: async () => {
        events.push('cleanup:start')
        await cleanupFinished
        events.push('cleanup:done')
      },
    },
    shouldApply: () => true,
    setAccessToken: () => {
      events.push('setAccessToken')
    },
  }).then(() => {
    completed = true
  })

  await waitForEvent(events, 'cleanup:start')

  expect(completed).toBe(false)
  expect(events).toEqual(['refresh', 'cleanup:start'])

  finishCleanup()
  await bootstrap

  expect(completed).toBe(true)
  expect(events).toEqual(['refresh', 'cleanup:start', 'cleanup:done'])
})

async function waitForEvent(events: string[], event: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (events.includes(event)) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error(`Timed out waiting for event: ${event}`)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
