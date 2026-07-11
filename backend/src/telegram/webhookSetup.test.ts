import { describe, expect, test } from 'bun:test'

import { ensureTelegramWebhook, telegramWebhookUrl } from './webhookSetup'

describe('Telegram webhook setup', () => {
  test('builds the production webhook URL from BACKEND_PUBLIC_URL', () => {
    expect(telegramWebhookUrl({ BACKEND_PUBLIC_URL: 'https://rolf-sales-rep-mvp-backend.onrender.com/' })).toBe(
      'https://rolf-sales-rep-mvp-backend.onrender.com/telegram/webhook',
    )
  })

  test('skips setup when token or public URL is missing', async () => {
    const calls: string[] = []
    const result = await ensureTelegramWebhook(
      { TELEGRAM_BOT_TOKEN: undefined, BACKEND_PUBLIC_URL: 'https://backend.example.com' },
      (async (input: RequestInfo | URL) => {
        calls.push(String(input))
        return new Response('{}')
      }) as typeof fetch,
    )

    expect(result).toEqual({ configured: false, webhookUrl: 'https://backend.example.com/telegram/webhook' })
    expect(calls).toEqual([])
  })

  test('registers webhook with Telegram Bot API', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const result = await ensureTelegramWebhook(
      { TELEGRAM_BOT_TOKEN: '123456:secret-token', BACKEND_PUBLIC_URL: 'https://backend.example.com' },
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
        return Response.json({ ok: true })
      }) as typeof fetch,
    )

    expect(result).toEqual({ configured: true, webhookUrl: 'https://backend.example.com/telegram/webhook' })
    expect(calls).toEqual([
      {
        url: 'https://api.telegram.org/bot123456:secret-token/setWebhook',
        body: {
          url: 'https://backend.example.com/telegram/webhook',
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        },
      },
    ])
  })
})
