import type { AppEnv } from '../env'

type TelegramSetWebhookResponse = {
  ok: boolean
  description?: string
}

export function telegramWebhookUrl(env: Pick<AppEnv, 'BACKEND_PUBLIC_URL'>) {
  return env.BACKEND_PUBLIC_URL ? `${env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')}/telegram/webhook` : null
}

export async function ensureTelegramWebhook(
  env: Pick<AppEnv, 'TELEGRAM_BOT_TOKEN' | 'BACKEND_PUBLIC_URL'>,
  fetchImpl: typeof fetch = fetch,
) {
  const webhookUrl = telegramWebhookUrl(env)
  if (!env.TELEGRAM_BOT_TOKEN || !webhookUrl) {
    console.warn('[telegram] Webhook auto-setup skipped: TELEGRAM_BOT_TOKEN or BACKEND_PUBLIC_URL is missing')
    return { configured: false, webhookUrl }
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  })

  const payload = await response.json().catch(() => null) as TelegramSetWebhookResponse | null
  if (!response.ok || !payload?.ok) {
    console.error('[telegram] Webhook auto-setup failed', {
      status: response.status,
      webhookUrl,
      description: payload?.description ?? 'Telegram response was not ok',
    })
    return { configured: false, webhookUrl }
  }

  console.info('[telegram] Webhook configured', { webhookUrl })
  return { configured: true, webhookUrl }
}
