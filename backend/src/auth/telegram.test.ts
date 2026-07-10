import { describe, expect, test } from 'bun:test'

import { AppError } from '../http/errors'
import {
  resolveTelegramDevUser,
  signTelegramInitData,
  verifyTelegramInitData,
} from './telegram'

const botToken = '123456:test-bot-token'
const now = new Date('2026-07-10T00:00:00.000Z')
const authDate = Math.floor(now.getTime() / 1000).toString()

function validInitData(overrides: Record<string, string> = {}) {
  return signTelegramInitData(
    {
      auth_date: authDate,
      query_id: 'query-1',
      user: JSON.stringify({
        id: 100001,
        username: 'demo_sales_rep',
        first_name: 'Demo',
        last_name: 'Rep',
      }),
      ...overrides,
    },
    botToken,
  )
}

describe('Telegram initData validation', () => {
  test('valid initData passes', () => {
    expect(verifyTelegramInitData(validInitData(), { TELEGRAM_BOT_TOKEN: botToken }, now)).toEqual({
      telegramId: '100001',
      username: 'demo_sales_rep',
      firstName: 'Demo',
      lastName: 'Rep',
    })
  })

  test('invalid hash fails', () => {
    const params = new URLSearchParams(validInitData())
    params.set('hash', '0'.repeat(64))

    expect(() =>
      verifyTelegramInitData(params.toString(), { TELEGRAM_BOT_TOKEN: botToken }, now),
    ).toThrow(AppError)
  })

  test('missing hash fails', () => {
    const params = new URLSearchParams(validInitData())
    params.delete('hash')

    expect(() =>
      verifyTelegramInitData(params.toString(), { TELEGRAM_BOT_TOKEN: botToken }, now),
    ).toThrow(AppError)
  })

  test('expired auth_date fails', () => {
    const expired = String(Math.floor(now.getTime() / 1000) - 24 * 60 * 60 - 1)

    expect(() =>
      verifyTelegramInitData(
        validInitData({ auth_date: expired }),
        { TELEGRAM_BOT_TOKEN: botToken },
        now,
      ),
    ).toThrow(AppError)
  })

  test('dev fallback is allowed only in development with ALLOW_DEV_AUTH=true', () => {
    const devUser = {
      telegramId: '100001',
      username: 'demo_sales_rep',
      firstName: 'Demo',
      lastName: 'Rep',
    }

    expect(
      resolveTelegramDevUser(devUser, {
        NODE_ENV: 'development',
        ALLOW_DEV_AUTH: true,
      }),
    ).toEqual(devUser)

    expect(() =>
      resolveTelegramDevUser(devUser, {
        NODE_ENV: 'production',
        ALLOW_DEV_AUTH: true,
      }),
    ).toThrow(AppError)

    expect(() =>
      resolveTelegramDevUser(devUser, {
        NODE_ENV: 'development',
        ALLOW_DEV_AUTH: false,
      }),
    ).toThrow(AppError)
  })
})
