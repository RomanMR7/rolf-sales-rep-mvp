import { describe, expect, test } from 'bun:test'

import { telegramBotLaunchUrl, telegramWebhookReplyForUpdate, telegramWebhookReplyForUpdateWithDb } from './bot'

describe('Telegram bot webhook helpers', () => {
  test('builds startapp launch URL from bot username', () => {
    expect(telegramBotLaunchUrl({ TELEGRAM_BOT_USERNAME: 'ALIRolfUae_bot' })).toBe(
      'https://t.me/ALIRolfUae_bot?startapp',
    )
  })

  test('returns a Telegram sendMessage webhook response with a Mini App button', () => {
    const reply = telegramWebhookReplyForUpdate(
      {
        message: {
          chat: { id: 123 },
          text: '/start',
        },
      },
      {
        TELEGRAM_WEBAPP_URL: 'https://rolf-sales-rep-mvp-webapp.vercel.app',
      },
    )

    expect(reply).toEqual({
      method: 'sendMessage',
      chat_id: 123,
      text: 'Откройте ROLF Dubai Mini App для управления заявками, менеджерами, скриптами и метриками.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть ROLF Dubai',
              web_app: { url: 'https://rolf-sales-rep-mvp-webapp.vercel.app' },
            },
          ],
        ],
      },
    })
  })

  test('ignores non-command webhook updates', () => {
    expect(
      telegramWebhookReplyForUpdate(
        { message: { chat: { id: 123 }, text: 'hello' } },
        { TELEGRAM_WEBAPP_URL: 'https://rolf-sales-rep-mvp-webapp.vercel.app' },
      ),
    ).toEqual({ ok: true })
  })

  test('answers owner inline menu callbacks instead of going silent', async () => {
    const db = {
      user: {
        findUnique: async () => ({ id: 'owner-id', role: 'OWNER', status: 'ACTIVE' }),
      },
      userCount: undefined,
      deal: { count: async () => 2 },
      activityLog: { count: async () => 3 },
    } as any
    db.user.count = async () => 4

    const reply = await telegramWebhookReplyForUpdateWithDb(
      {
        callback_query: {
          id: 'callback-1',
          from: { id: 700001 },
          message: { chat: { id: 123 } },
          data: 'menu:system',
        },
      },
      { TELEGRAM_WEBAPP_URL: 'https://rolf-sales-rep-mvp-webapp.vercel.app' },
      db,
    )

    expect(reply).toMatchObject({
      method: 'sendMessage',
      chat_id: 123,
      text: expect.stringContaining('Система ROLF Dubai'),
    })
  })
})
