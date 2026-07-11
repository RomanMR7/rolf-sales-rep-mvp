import type { AppEnv } from '../env'

type TelegramWebhookReply = {
  ok?: boolean
  method?: string
  chat_id?: string | number
  text?: string
  reply_markup?: unknown
}

export async function sendTelegramWebhookReply(
  env: Pick<AppEnv, 'TELEGRAM_BOT_TOKEN'>,
  reply: TelegramWebhookReply,
  fetchImpl: typeof fetch = fetch,
) {
  if (!env.TELEGRAM_BOT_TOKEN || reply.method !== 'sendMessage' || !reply.chat_id || !reply.text) {
    return false
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: reply.chat_id,
      text: reply.text,
      reply_markup: reply.reply_markup,
    }),
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null
  if (!response.ok || !payload?.ok) {
    console.error('[telegram] sendMessage failed', {
      status: response.status,
      description: payload?.description ?? 'Telegram response was not ok',
    })
    return false
  }
  return true
}
