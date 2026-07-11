import { describe, expect, test } from 'bun:test'

import { sendTelegramWebhookReply } from './send'

describe('Telegram sendMessage delivery', () => {
  test('skips explicit send without bot token', async () => {
    const calls: string[] = []
    const delivered = await sendTelegramWebhookReply(
      { TELEGRAM_BOT_TOKEN: undefined },
      { method: 'sendMessage', chat_id: 123, text: 'hello' },
      (async (input: RequestInfo | URL) => {
        calls.push(String(input))
        return Response.json({ ok: true })
      }) as typeof fetch,
    )

    expect(delivered).toBe(false)
    expect(calls).toEqual([])
  })

  test('sends webhook reply through Telegram sendMessage', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const delivered = await sendTelegramWebhookReply(
      { TELEGRAM_BOT_TOKEN: '123456:secret-token' },
      {
        method: 'sendMessage',
        chat_id: 123,
        text: 'hello',
        reply_markup: { inline_keyboard: [[{ text: 'Open', url: 'https://example.com' }]] },
      },
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
        return Response.json({ ok: true })
      }) as typeof fetch,
    )

    expect(delivered).toBe(true)
    expect(calls).toEqual([
      {
        url: 'https://api.telegram.org/bot123456:secret-token/sendMessage',
        body: {
          chat_id: 123,
          text: 'hello',
          reply_markup: { inline_keyboard: [[{ text: 'Open', url: 'https://example.com' }]] },
        },
      },
    ])
  })
})
