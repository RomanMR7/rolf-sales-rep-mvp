import { describe, expect, test } from 'bun:test'

import { telegramBotLaunchUrl, telegramWebhookReplyForUpdate } from './bot'

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
      text: 'Open the ROLF Sales App Mini App to manage leads, managers, scripts, and metrics.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open ROLF Sales App',
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
})
