export {}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }

  type TelegramWebApp = {
    initData: string
    initDataUnsafe?: {
      user?: {
        id?: number
        username?: string
        first_name?: string
        last_name?: string
      }
    }
    ready: () => void
    expand?: () => void
  }
}
