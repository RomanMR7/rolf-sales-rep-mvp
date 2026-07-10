import type { AppEnv } from '../env'

type TelegramMessage = {
  chat: { id: number | string }
  text?: string
}

type TelegramUpdate = {
  message?: TelegramMessage
}

export function telegramBotLaunchUrl(env: Pick<AppEnv, 'TELEGRAM_BOT_USERNAME'>) {
  return env.TELEGRAM_BOT_USERNAME ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp` : null
}

export function telegramBotResponseForUpdate(update: TelegramUpdate, env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>) {
  const message = update.message
  if (!message?.text) return null

  const command = message.text.split(/\s+/)[0]
  if (!['/start', '/help', '/settings'].includes(command)) return null

  const text =
    command === '/settings'
      ? 'Open ROLF Sales App settings in the Mini App.'
      : 'Open the ROLF Sales App Mini App to manage leads, managers, scripts, and metrics.'

  return {
    chat_id: message.chat.id,
    text,
    reply_markup: env.TELEGRAM_WEBAPP_URL
      ? {
          inline_keyboard: [
            [
              {
                text: 'Open ROLF Sales App',
                web_app: { url: env.TELEGRAM_WEBAPP_URL },
              },
            ],
          ],
        }
      : undefined,
  }
}
