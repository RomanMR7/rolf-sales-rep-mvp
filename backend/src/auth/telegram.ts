import { createHmac, timingSafeEqual } from 'node:crypto'

import type { TelegramDevUser } from '@rolf-sales-rep-mvp/contracts'

import type { AppEnv } from '../env'
import { AppError } from '../http/errors'

const telegramAuthTtlSeconds = 24 * 60 * 60

export type TelegramUserProfile = {
  telegramId: string
  username?: string
  firstName?: string
  lastName?: string
}

export function verifyTelegramInitData(
  initData: string,
  env: Pick<AppEnv, 'TELEGRAM_BOT_TOKEN'>,
  now = new Date(),
): TelegramUserProfile {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Telegram bot token is not configured')
  }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram initData hash is required')
  }

  const authDateValue = params.get('auth_date')
  const authDate = authDateValue ? Number(authDateValue) : Number.NaN
  if (!Number.isFinite(authDate)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram auth_date is required')
  }

  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate
  if (ageSeconds < 0 || ageSeconds > telegramAuthTtlSeconds) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram initData is expired')
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (!safeHexEqual(hash, expectedHash)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram initData signature is invalid')
  }

  return telegramUserFromJson(params.get('user'))
}

export function resolveTelegramDevUser(
  devUser: TelegramDevUser,
  env: Pick<AppEnv, 'NODE_ENV' | 'ALLOW_DEV_AUTH'>,
): TelegramUserProfile {
  // Local MVP development only. Production must never trust a frontend-supplied Telegram user.
  if (env.NODE_ENV !== 'development' || !env.ALLOW_DEV_AUTH) {
    throw new AppError(403, 'FORBIDDEN', 'Telegram dev auth is disabled')
  }

  return {
    telegramId: devUser.telegramId,
    username: devUser.username,
    firstName: devUser.firstName,
    lastName: devUser.lastName,
  }
}

export function signTelegramInitData(
  fields: Record<string, string>,
  botToken: string,
) {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const params = new URLSearchParams(fields)
  params.set('hash', hash)
  return params.toString()
}

function telegramUserFromJson(rawUser: string | null): TelegramUserProfile {
  if (!rawUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram user payload is required')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawUser)
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram user payload is invalid')
  }

  if (!isTelegramUserPayload(parsed)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Telegram user payload is invalid')
  }

  return {
    telegramId: String(parsed.id),
    username: parsed.username,
    firstName: parsed.first_name,
    lastName: parsed.last_name,
  }
}

function isTelegramUserPayload(value: unknown): value is {
  id: number | string
  username?: string
  first_name?: string
  last_name?: string
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'number' || typeof candidate.id === 'string'
}

function safeHexEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
