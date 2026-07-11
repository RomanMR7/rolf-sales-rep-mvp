import { randomUUID } from 'node:crypto'

import type { AppEnv } from '../env'
import type { DbClient } from '../db'
import { parseBotTextCommand, type ParsedBotAction } from './botCommandParser'

type TelegramMessage = {
  chat: { id: number | string }
  from?: { id: number | string }
  text?: string
}

type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: { id: number | string }
    message?: { chat: { id: number | string } }
    data?: string
  }
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
      ? 'Откройте настройки ROLF Dubai в Mini App.'
      : 'Откройте ROLF Dubai Mini App для управления заявками, менеджерами, скриптами и метриками.'

  return {
    chat_id: message.chat.id,
    text,
    reply_markup: env.TELEGRAM_WEBAPP_URL
      ? {
          inline_keyboard: [
            [
              {
                text: 'Открыть ROLF Dubai',
                web_app: { url: env.TELEGRAM_WEBAPP_URL },
              },
            ],
          ],
        }
      : undefined,
  }
}

export async function telegramBotResponseForUpdateWithDb(
  update: TelegramUpdate,
  env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>,
  db: DbClient,
) {
  const callback = update.callback_query
  if (callback?.data) {
    return handleCallback(callback, db, env)
  }

  const message = update.message
  if (!message?.text) return null
  const user = message.from?.id
    ? await db.user.findUnique({ where: { telegramId: String(message.from.id) } })
    : null
  const role = publicRole(user?.role ?? 'VIEWER')
  const command = message.text.split(/\s+/)[0]

  if (command === '/start') {
    return {
      chat_id: message.chat.id,
      text: role === 'OWNER' || role === 'ADMIN'
        ? 'Кабинет ROLF Dubai готов. Выберите быстрое действие или откройте Mini App.'
        : 'Откройте Mini App ROLF Dubai для работы с заявками.',
      reply_markup: mainMenu(role, env.TELEGRAM_WEBAPP_URL),
    }
  }

  if (command === '/help') {
    return {
      chat_id: message.chat.id,
      text: helpText(role),
      reply_markup: mainMenu(role, env.TELEGRAM_WEBAPP_URL),
    }
  }

  if (command === '/me') {
    return {
      chat_id: message.chat.id,
      text: user
        ? `Вы: ${user.displayName ?? user.email}\nTelegram ID: ${user.telegramId ?? 'не привязан'}\nРоль: ${roleLabel(role)}\nСтатус: ${statusLabel(user.status)}`
        : `Telegram ID: ${message.from?.id ?? 'неизвестно'}\nПользователь не найден в системе.`,
      reply_markup: mainMenu(role, env.TELEGRAM_WEBAPP_URL),
    }
  }

  if (command === '/metrics') return metricsMenu(message.chat.id, role, db)
  if (command === '/managers') return managersMenu(message.chat.id, role, db)
  if (command === '/leads') return leadsMenu(message.chat.id, role, db)
  if (command === '/settings') return settingsMenu(message.chat.id, role, env.TELEGRAM_WEBAPP_URL)
  if (command === '/owner') return ownerMenu(message.chat.id, role, env.TELEGRAM_WEBAPP_URL)

  const parsed = parseBotTextCommand(message.text)
  if (parsed.intent === 'unknown') return null
  if (!user || !['OWNER', 'ADMIN'].includes(role)) {
    return {
      chat_id: message.chat.id,
      text: 'Недостаточно прав. Изменять данные через бота могут только Владелец и Администратор.',
    }
  }
  if (parsed.requiresConfirmation) {
    const pending = await db.botActionConfirmation.create({
      data: {
        telegramChatId: String(message.chat.id),
        telegramUserId: String(message.from?.id ?? ''),
        actorUserId: user.id,
        intent: parsed.intent,
        payloadJson: parsed as any,
        riskLevel: parsed.riskLevel,
        idempotencyKey: `${parsed.intent}:${user.id}:${Date.now()}`,
      },
    })
    return {
      chat_id: message.chat.id,
      text: confirmationText(parsed),
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `confirm:${pending.id}` },
          { text: '❌ Отмена', callback_data: `cancel:${pending.id}` },
        ]],
      },
    }
  }

  return {
    chat_id: message.chat.id,
    text: `Я понял действие: ${intentLabel(parsed.intent)}. Для выполнения откройте кабинет или используйте команду с подтверждением.`,
  }
}

export function telegramWebhookReplyForUpdate(update: TelegramUpdate, env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>) {
  const response = telegramBotResponseForUpdate(update, env)
  if (!response) return { ok: true }

  return {
    method: 'sendMessage',
    ...response,
  }
}

export async function telegramWebhookReplyForUpdateWithDb(
  update: TelegramUpdate,
  env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>,
  db: DbClient,
) {
  const response = await telegramBotResponseForUpdateWithDb(update, env, db)
  if (!response) return { ok: true }

  return {
    method: 'sendMessage',
    ...response,
  }
}

async function handleCallback(
  callback: NonNullable<TelegramUpdate['callback_query']>,
  db: DbClient,
  env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>,
) {
  const data = callback.data ?? ''
  const botUser = await botUserFromCallback(callback, db)
  if (data.startsWith('menu:')) return handleMenuCallback(callback, data, botUser, db, env)
  if (data.startsWith('managers:')) return handleManagersCallback(callback, data, botUser, db)
  if (data.startsWith('manager:')) return handleManagerDetailCallback(callback, data, botUser, db)
  if (data.startsWith('role:')) return handleRoleChoiceCallback(callback, data, botUser, db)
  if (data.startsWith('setrole:')) return createConfirmedActionFromCallback(callback, data, botUser, db, 'manager_role_change')
  if (data.startsWith('status:')) return handleStatusChoiceCallback(callback, data, botUser, db)
  if (data.startsWith('setstatus:')) return createConfirmedActionFromCallback(callback, data, botUser, db, 'manager_status')
  if (data.startsWith('settings:')) return createConfirmedActionFromCallback(callback, data, botUser, db, 'function_toggle')
  if (data.startsWith('preview:')) return handleOwnerPreviewCallback(callback, data, botUser, db)
  if (data.startsWith('impersonate:')) return handleOwnerImpersonateCallback(callback, data, botUser, db)
  if (data === 'owner:stop') return handleOwnerStopCallback(callback, botUser, db)

  const [action, id] = data.split(':')
  if (!id || !['confirm', 'cancel'].includes(action)) return null
  const pending = await db.botActionConfirmation.findUnique({ where: { id } })
  if (!pending || pending.status !== 'PENDING') {
    return { chat_id: callback.message?.chat.id ?? callback.from.id, text: 'Это подтверждение уже обработано или устарело.' }
  }
  if (action === 'cancel') {
    await db.botActionConfirmation.update({ where: { id }, data: { status: 'CANCELLED' } })
    return { chat_id: callback.message?.chat.id ?? callback.from.id, text: 'Действие отменено.' }
  }
  await db.$transaction(async (tx) => {
    const updated = await tx.botActionConfirmation.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'EXECUTED', executedAt: new Date() },
    })
    if (updated.count !== 1) return
    await executeConfirmedBotAction(tx, pending)
    await tx.activityLog.create({
      data: {
        actorUserId: pending.actorUserId,
        effectiveUserId: pending.actorUserId,
        entityType: 'bot_action',
        entityId: pending.id,
        action: pending.intent,
        actionSource: 'telegram_bot',
        idempotencyKey: pending.idempotencyKey,
        payloadJson: pending.payloadJson as any,
      },
    })
  })
  return { chat_id: callback.message?.chat.id ?? callback.from.id, text: 'Готово. Действие подтверждено и записано в audit log.' }
}

async function botUserFromCallback(callback: NonNullable<TelegramUpdate['callback_query']>, db: DbClient) {
  return db.user.findUnique({ where: { telegramId: String(callback.from.id) } })
}

function callbackChatId(callback: NonNullable<TelegramUpdate['callback_query']>) {
  return callback.message?.chat.id ?? callback.from.id
}

function ensureBotAdmin(callback: NonNullable<TelegramUpdate['callback_query']>, user: any) {
  const role = publicRole(user?.role ?? 'VIEWER')
  if (!user || !['OWNER', 'ADMIN'].includes(role)) {
    return { chat_id: callbackChatId(callback), text: 'Недостаточно прав. Управление через бота доступно только владельцу и администратору.' }
  }
  return null
}

function ensureBotOwner(callback: NonNullable<TelegramUpdate['callback_query']>, user: any) {
  const role = publicRole(user?.role ?? 'VIEWER')
  if (!user || role !== 'OWNER') {
    return { chat_id: callbackChatId(callback), text: 'Это действие доступно только владельцу.' }
  }
  return null
}

async function handleMenuCallback(
  callback: NonNullable<TelegramUpdate['callback_query']>,
  data: string,
  user: any,
  db: DbClient,
  env: Pick<AppEnv, 'TELEGRAM_WEBAPP_URL'>,
) {
  const role = publicRole(user?.role ?? 'VIEWER')
  const chatId = callbackChatId(callback)
  const section = data.split(':')[1]
  if (section === 'metrics') return metricsMenu(chatId, role, db)
  if (section === 'managers') return managersMenu(chatId, role, db)
  if (section === 'leads') return leadsMenu(chatId, role, db)
  if (section === 'settings') return settingsMenu(chatId, role, env.TELEGRAM_WEBAPP_URL)
  if (section === 'owner') return ownerMenu(chatId, role, env.TELEGRAM_WEBAPP_URL)
  if (section === 'system') return systemMenu(chatId, role, db)
  return { chat_id: chatId, text: 'Раздел пока недоступен.' }
}

async function handleManagersCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotAdmin(callback, user)
  if (denied) return denied
  const action = data.split(':')[1]
  if (action === 'add') {
    return {
      chat_id: callbackChatId(callback),
      text: 'Чтобы добавить менеджера, отправьте:\nдобавь менеджера Имя Фамилия telegram id 123456789',
    }
  }
  return managerPickerMenu(callbackChatId(callback), db)
}

async function managerPickerMenu(chatId: string | number, db: DbClient) {
  const users = await db.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER', 'SALES_REP'] } },
    take: 10,
    orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
  })
  return {
    chat_id: chatId,
    text: users.length ? 'Выберите пользователя для управления:' : 'Пользователей для управления пока нет.',
    reply_markup: {
      inline_keyboard: [
        ...users.map((user) => ([{
          text: `${user.displayName ?? user.email} — ${roleLabel(publicRole(user.role))}, ${statusLabel(user.status)}`,
          callback_data: `manager:${user.id}`,
        }])),
        [{ text: 'Назад', callback_data: 'menu:managers' }],
      ],
    },
  }
}

async function handleManagerDetailCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotAdmin(callback, user)
  if (denied) return denied
  const id = data.slice('manager:'.length)
  const manager = await db.user.findUnique({ where: { id }, include: { managerProfile: true } })
  if (!manager) return { chat_id: callbackChatId(callback), text: 'Пользователь не найден.' }
  const role = publicRole(manager.role)
  const buttons = [
    [{ text: 'Сменить роль', callback_data: `role:${manager.id}` }, { text: 'Статус', callback_data: `status:${manager.id}` }],
  ]
  if (publicRole(user.role) === 'OWNER') buttons.push([{ text: 'Работать как этот пользователь', callback_data: `impersonate:${manager.id}` }])
  buttons.push([{ text: 'Назад к списку', callback_data: 'managers:list' }])
  return {
    chat_id: callbackChatId(callback),
    text: [
      `Пользователь: ${manager.displayName ?? manager.email}`,
      `Роль: ${roleLabel(role)}`,
      `Статус: ${statusLabel(manager.status)}`,
      `Telegram ID: ${manager.telegramId ?? 'не привязан'}`,
      manager.managerProfile?.phone ? `Телефон: ${manager.managerProfile.phone}` : null,
    ].filter(Boolean).join('\n'),
    reply_markup: { inline_keyboard: buttons },
  }
}

async function handleRoleChoiceCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotAdmin(callback, user)
  if (denied) return denied
  const id = data.slice('role:'.length)
  const manager = await db.user.findUnique({ where: { id } })
  if (!manager) return { chat_id: callbackChatId(callback), text: 'Пользователь не найден.' }
  if (manager.role === 'OWNER') return { chat_id: callbackChatId(callback), text: 'Роль владельца через бота менять нельзя.' }
  const roles = publicRole(user.role) === 'OWNER'
    ? ['ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER']
    : ['SUPERVISOR', 'MANAGER', 'VIEWER']
  return {
    chat_id: callbackChatId(callback),
    text: `Выберите новую роль для ${manager.displayName ?? manager.email}:`,
    reply_markup: {
      inline_keyboard: [
        ...roles.map((role) => ([{ text: roleLabel(role), callback_data: `setrole:${manager.id}:${role}` }])),
        [{ text: 'Назад', callback_data: `manager:${manager.id}` }],
      ],
    },
  }
}

async function handleStatusChoiceCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotAdmin(callback, user)
  if (denied) return denied
  const id = data.slice('status:'.length)
  const manager = await db.user.findUnique({ where: { id } })
  if (!manager) return { chat_id: callbackChatId(callback), text: 'Пользователь не найден.' }
  if (manager.role === 'OWNER') return { chat_id: callbackChatId(callback), text: 'Статус владельца через бота менять нельзя.' }
  const statuses = ['ACTIVE', 'INVITED', 'BLOCKED', 'DISABLED']
  return {
    chat_id: callbackChatId(callback),
    text: `Выберите статус для ${manager.displayName ?? manager.email}:`,
    reply_markup: {
      inline_keyboard: [
        ...statuses.map((status) => ([{ text: statusLabel(status), callback_data: `setstatus:${manager.id}:${status}` }])),
        [{ text: 'Назад', callback_data: `manager:${manager.id}` }],
      ],
    },
  }
}

async function createConfirmedActionFromCallback(
  callback: NonNullable<TelegramUpdate['callback_query']>,
  data: string,
  user: any,
  db: DbClient,
  intent: ParsedBotAction['intent'],
) {
  const denied = ensureBotAdmin(callback, user)
  if (denied) return denied
  const parsed = await parsedActionFromCallback(data, intent, db)
  if (!parsed) return { chat_id: callbackChatId(callback), text: 'Не удалось разобрать действие.' }
  const pending = await db.botActionConfirmation.create({
    data: {
      telegramChatId: String(callbackChatId(callback)),
      telegramUserId: String(callback.from.id),
      actorUserId: user.id,
      intent: parsed.intent,
      payloadJson: parsed as any,
      riskLevel: parsed.riskLevel,
      idempotencyKey: `${parsed.intent}:${user.id}:${Date.now()}`,
    },
  })
  return {
    chat_id: callbackChatId(callback),
    text: confirmationText(parsed),
    reply_markup: { inline_keyboard: [[
      { text: 'Подтвердить', callback_data: `confirm:${pending.id}` },
      { text: 'Отмена', callback_data: `cancel:${pending.id}` },
    ]] },
  }
}

async function parsedActionFromCallback(data: string, intent: ParsedBotAction['intent'], db: DbClient): Promise<ParsedBotAction | null> {
  const parts = data.split(':')
  if (intent === 'manager_role_change' && parts.length === 3) {
    return { intent, entity: 'manager', params: { userId: parts[1], role: parts[2] }, requiresConfirmation: true, riskLevel: 'high' }
  }
  if (intent === 'manager_status' && parts.length === 3) {
    return { intent, entity: 'manager', params: { userId: parts[1], status: parts[2] }, requiresConfirmation: true, riskLevel: 'high' }
  }
  if (intent === 'function_toggle' && parts.length === 2) {
    const existing = await db.functionSetting.findUnique({ where: { key: parts[1] } })
    return { intent, entity: 'function', params: { key: parts[1], enabled: !existing?.enabled }, requiresConfirmation: true, riskLevel: 'high' }
  }
  return null
}

async function handleOwnerPreviewCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotOwner(callback, user)
  if (denied) return denied
  const role = data.split(':')[1]
  if (!['ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'].includes(role)) {
    return { chat_id: callbackChatId(callback), text: 'Эта роль недоступна для preview.' }
  }
  const changed = await updateLatestOwnerSession(db, user.id, { ownerMode: 'ROLE_PREVIEW', effectiveRole: role, effectiveUserId: null })
  await db.activityLog.create({
    data: {
      actorUserId: user.id,
      effectiveUserId: user.id,
      entityType: 'auth_session',
      entityId: changed?.id ?? user.id,
      action: 'owner_preview_role',
      actionSource: 'telegram_bot',
      payloadJson: { role },
    },
  })
  return {
    chat_id: callbackChatId(callback),
    text: changed
      ? `Готово. Активная Mini App сессия владельца переключена в режим: ${roleLabel(role)}.`
      : `Режим ${roleLabel(role)} выбран, но активная Mini App сессия не найдена. Сначала войдите в Mini App через Telegram.`,
  }
}

async function handleOwnerImpersonateCallback(callback: NonNullable<TelegramUpdate['callback_query']>, data: string, user: any, db: DbClient) {
  const denied = ensureBotOwner(callback, user)
  if (denied) return denied
  const targetId = data.slice('impersonate:'.length)
  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target || target.role === 'OWNER') return { chat_id: callbackChatId(callback), text: 'Этого пользователя нельзя выбрать для impersonation.' }
  const changed = await updateLatestOwnerSession(db, user.id, { ownerMode: 'USER_IMPERSONATION', effectiveRole: target.role, effectiveUserId: target.id })
  await db.activityLog.create({
    data: {
      actorUserId: user.id,
      effectiveUserId: target.id,
      entityType: 'auth_session',
      entityId: changed?.id ?? user.id,
      action: 'owner_impersonation_start',
      actionSource: 'telegram_bot',
      payloadJson: { targetUserId: target.id },
    },
  })
  return {
    chat_id: callbackChatId(callback),
    text: changed
      ? `Готово. Активная Mini App сессия владельца теперь работает как ${target.displayName ?? target.email}.`
      : 'Пользователь выбран, но активная Mini App сессия владельца не найдена. Сначала войдите в Mini App через Telegram.',
  }
}

async function handleOwnerStopCallback(callback: NonNullable<TelegramUpdate['callback_query']>, user: any, db: DbClient) {
  const denied = ensureBotOwner(callback, user)
  if (denied) return denied
  const changed = await updateLatestOwnerSession(db, user.id, { ownerMode: null, effectiveRole: null, effectiveUserId: null })
  await db.activityLog.create({
    data: {
      actorUserId: user.id,
      effectiveUserId: user.id,
      entityType: 'auth_session',
      entityId: changed?.id ?? user.id,
      action: 'owner_impersonation_stop',
      actionSource: 'telegram_bot',
      payloadJson: {},
    },
  })
  return { chat_id: callbackChatId(callback), text: changed ? 'Готово. Режим владельца выключен.' : 'Активная Mini App сессия владельца не найдена.' }
}

async function updateLatestOwnerSession(db: any, ownerId: string, data: { ownerMode: string | null; effectiveRole: string | null; effectiveUserId: string | null }) {
  const session = await db.authSession.findFirst({
    where: { userId: ownerId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) return null
  return db.authSession.update({ where: { id: session.id }, data: data as any })
}

async function executeConfirmedBotAction(tx: any, pending: { intent: string; payloadJson: unknown; actorUserId: string }) {
  const parsed = pending.payloadJson as ParsedBotAction
  const params = parsed.params ?? {}
  if (pending.intent === 'manager_create') {
    const telegramId = String(params.telegramId ?? '').trim()
    const name = String(params.name ?? '').trim()
    if (!telegramId || !name) return
    await tx.user.upsert({
      where: { telegramId },
      create: {
        email: `telegram-${telegramId}@telegram.rolf-sales-rep-mvp.local`,
        passwordHash: await Bun.password.hash(randomUUID()),
        displayName: name,
        telegramId,
        role: 'MANAGER',
        status: 'ACTIVE',
      },
      update: {
        displayName: name,
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    })
    return
  }
  if (pending.intent === 'manager_role_change') {
    const user = await findUserForBotAction(tx, params)
    if (!user || user.role === 'OWNER') return
    await tx.user.update({ where: { id: user.id }, data: { role: String(params.role) } })
    return
  }
  if (pending.intent === 'manager_status') {
    const user = await findUserForBotAction(tx, params)
    if (!user || user.role === 'OWNER') return
    await tx.user.update({ where: { id: user.id }, data: { status: String(params.status) } })
    return
  }
  if (pending.intent === 'function_toggle') {
    const key = String(params.key ?? '')
    if (!key) return
    await tx.functionSetting.upsert({
      where: { key },
      create: {
        key,
        title: key,
        enabled: Boolean(params.enabled),
        updatedBy: pending.actorUserId,
      },
      update: {
        enabled: Boolean(params.enabled),
        updatedBy: pending.actorUserId,
      },
    })
    return
  }
  if (pending.intent === 'metric_manual_entry') {
    const user = await findUserForBotAction(tx, params)
    if (!user) return
    const date = dateForPeriod(String(params.period ?? 'today'))
    const existing = await tx.managerDailyMetric.findUnique({ where: { managerId_date: { managerId: user.id, date } } })
    const add = params.mode === 'add'
    const leadsNew = metricValue(params.leadsNew, existing?.leadsNew, add)
    const dealsSuccess = metricValue(params.dealsSuccess, existing?.dealsSuccess, add)
    const dealsCancelled = metricValue(params.dealsCancelled, existing?.dealsCancelled, add)
    const totalAmount = metricValue(params.totalAmount, Number(existing?.totalAmount ?? 0), add)
    const totalClosed = dealsSuccess + dealsCancelled
    await tx.managerDailyMetric.upsert({
      where: { managerId_date: { managerId: user.id, date } },
      create: {
        managerId: user.id,
        date,
        leadsNew,
        dealsSuccess,
        dealsCancelled,
        totalAmount,
        conversionRate: totalClosed > 0 ? Math.round((dealsSuccess / totalClosed) * 10000) / 100 : 0,
        source: 'manual_bot_entry',
        note: 'Внесено через Telegram-бота',
      },
      update: {
        leadsNew,
        dealsSuccess,
        dealsCancelled,
        totalAmount,
        conversionRate: totalClosed > 0 ? Math.round((dealsSuccess / totalClosed) * 10000) / 100 : 0,
        source: 'manual_bot_entry',
        note: 'Внесено через Telegram-бота',
      },
    })
    return
  }
  if (pending.intent === 'lead_create') {
    const clientName = String(params.clientName ?? '').trim()
    if (!clientName) return
    await tx.deal.create({
      data: {
        title: clientName,
        clientName,
        amount: typeof params.amount === 'number' ? params.amount : 0,
        source: params.source ? String(params.source) : null,
        status: 'NEW',
        createdBy: pending.actorUserId,
      },
    })
    return
  }
  if (pending.intent === 'lead_assign') {
    const leadId = String(params.leadId ?? '')
    if (!isUuid(leadId)) return
    const manager = await findUserForBotAction(tx, params)
    if (!manager) return
    await tx.deal.updateMany({
      where: { id: leadId },
      data: {
        assignedManagerId: manager.id,
        status: 'TAKEN',
      },
    })
    return
  }
  if (pending.intent === 'lead_status') {
    const leadId = String(params.leadId ?? '')
    const status = String(params.status ?? '')
    if (!isUuid(leadId) || !['SUCCESS', 'CANCELLED'].includes(status)) return
    await tx.deal.updateMany({
      where: { id: leadId },
      data: {
        status,
        closedAt: new Date(),
      },
    })
    return
  }
  if (pending.intent === 'owner_preview_role') {
    const role = String(params.role ?? '')
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'].includes(role)) return
    await updateLatestOwnerSession(tx, pending.actorUserId, { ownerMode: 'ROLE_PREVIEW', effectiveRole: role, effectiveUserId: null })
    return
  }
  if (pending.intent === 'owner_impersonate') {
    const user = await findUserForBotAction(tx, params)
    if (!user || user.role === 'OWNER') return
    await updateLatestOwnerSession(tx, pending.actorUserId, { ownerMode: 'USER_IMPERSONATION', effectiveRole: user.role, effectiveUserId: user.id })
  }
}

async function findUserForBotAction(tx: any, params: Record<string, unknown>) {
  if (params.userId && isUuid(String(params.userId))) return tx.user.findUnique({ where: { id: String(params.userId) } })
  if (params.telegramId) return tx.user.findUnique({ where: { telegramId: String(params.telegramId) } })
  const name = String(params.name ?? params.managerName ?? '').trim()
  if (!name) return null
  return tx.user.findFirst({
    where: {
      OR: [
        { displayName: { contains: name, mode: 'insensitive' } },
        { email: { contains: name, mode: 'insensitive' } },
      ],
    },
  })
}

function dateForPeriod(period: string) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  if (period === 'yesterday') date.setUTCDate(date.getUTCDate() - 1)
  return date
}

function metricValue(value: unknown, current: number | undefined, add: boolean) {
  if (typeof value !== 'number') return current ?? 0
  return add ? (current ?? 0) + value : value
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function mainMenu(role: string, webAppUrl?: string | null) {
  const rows = []
  if (role === 'OWNER' || role === 'ADMIN') {
    rows.push([{ text: '📊 Метрики', callback_data: 'menu:metrics' }, { text: '👥 Менеджеры', callback_data: 'menu:managers' }])
    rows.push([{ text: '🧾 Заявки', callback_data: 'menu:leads' }, { text: '⚙️ Настройки', callback_data: 'menu:settings' }])
  }
  if (role === 'OWNER') rows.push([{ text: '🧑‍💼 Режим владельца', callback_data: 'menu:owner' }, { text: '🚨 Система', callback_data: 'menu:system' }])
  if (webAppUrl) rows.push([{ text: '🚀 Открыть кабинет', web_app: { url: webAppUrl } }])
  return rows.length ? { inline_keyboard: rows } : undefined
}

async function metricsMenu(chatId: string | number, role: string, db: DbClient) {
  if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER'].includes(role)) return { chat_id: chatId, text: 'Метрики недоступны для вашей роли.' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const metrics = await db.managerDailyMetric.aggregate({
    where: { date: { gte: today } },
    _sum: { leadsNew: true, dealsSuccess: true, dealsCancelled: true, totalAmount: true },
    _avg: { conversionRate: true },
  })
  return {
    chat_id: chatId,
    text: `Метрики за сегодня:\nЛиды: ${metrics._sum.leadsNew ?? 0}\nУспешные сделки: ${metrics._sum.dealsSuccess ?? 0}\nОтмены: ${metrics._sum.dealsCancelled ?? 0}\nСумма: AED ${Number(metrics._sum.totalAmount ?? 0).toLocaleString()}\nКонверсия: ${Number(metrics._avg.conversionRate ?? 0)}%`,
    reply_markup: { inline_keyboard: [[{ text: 'Сегодня', callback_data: 'metrics:today' }, { text: 'Вчера', callback_data: 'metrics:yesterday' }, { text: '7 дней', callback_data: 'metrics:7d' }], [{ text: 'По менеджерам', callback_data: 'metrics:managers' }]] },
  }
}

async function managersMenu(chatId: string | number, role: string, db: DbClient) {
  if (!['OWNER', 'ADMIN'].includes(role)) return { chat_id: chatId, text: 'Менеджеры доступны только владельцу и администратору.' }
  const managers = await db.user.findMany({ where: { role: { in: ['MANAGER', 'SUPERVISOR'] } }, take: 8, orderBy: { displayName: 'asc' } })
  return { chat_id: chatId, text: `Менеджеры:\n${managers.map((m) => `${m.displayName ?? m.email} — ${roleLabel(publicRole(m.role))}, ${statusLabel(m.status)}`).join('\n') || 'Пока нет менеджеров.'}`, reply_markup: { inline_keyboard: [[{ text: 'Список', callback_data: 'managers:list' }, { text: 'Добавить', callback_data: 'managers:add' }, { text: 'Роли', callback_data: 'managers:roles' }]] } }
}

async function leadsMenu(chatId: string | number, role: string, db: DbClient) {
  if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER'].includes(role)) return { chat_id: chatId, text: 'Заявки недоступны для вашей роли.' }
  const leads = await db.deal.findMany({ where: { status: { in: ['NEW', 'TAKEN', 'IN_PROGRESS'] } }, take: 8, orderBy: { createdAt: 'desc' } })
  return { chat_id: chatId, text: `Активные заявки:\n${leads.map((lead) => `${lead.title} — ${lead.clientName}, AED ${Number(lead.amount)}`).join('\n') || 'Активных заявок нет.'}`, reply_markup: { inline_keyboard: [[{ text: 'Новые', callback_data: 'leads:new' }, { text: 'В работе', callback_data: 'leads:progress' }, { text: 'Создать заявку', callback_data: 'leads:create' }]] } }
}

function settingsMenu(chatId: string | number, role: string, webAppUrl?: string | null) {
  if (!['OWNER', 'ADMIN'].includes(role)) return { chat_id: chatId, text: 'Настройки доступны только владельцу и администратору.' }
  return { chat_id: chatId, text: 'Быстрые параметры:', reply_markup: { inline_keyboard: [[{ text: 'Автоназначение ON/OFF', callback_data: 'settings:auto_assign' }], [{ text: 'Уведомления OWNER', callback_data: 'settings:owner_notifications' }, { text: 'Уведомления ADMIN', callback_data: 'settings:admin_notifications' }], ...(webAppUrl ? [[{ text: 'Открыть настройки', web_app: { url: webAppUrl } }]] : [])] } }
}

function ownerMenu(chatId: string | number, role: string, webAppUrl?: string | null) {
  if (role !== 'OWNER') return { chat_id: chatId, text: 'Команда /owner доступна только владельцу.' }
  return { chat_id: chatId, text: 'Режим владельца:', reply_markup: { inline_keyboard: [[{ text: 'Смотреть как ADMIN', callback_data: 'preview:ADMIN' }, { text: 'Смотреть как MANAGER', callback_data: 'preview:MANAGER' }], [{ text: 'Выйти из режима', callback_data: 'owner:stop' }], ...(webAppUrl ? [[{ text: 'Открыть Owner Command Center', web_app: { url: `${webAppUrl.replace(/\/+$/, '')}/app/owner` } }]] : [])] } }
}

async function systemMenu(chatId: string | number, role: string, db: DbClient) {
  if (role !== 'OWNER') return { chat_id: chatId, text: 'Системный статус доступен только владельцу.' }
  const [activeManagers, openLeads, todayActions] = await Promise.all([
    db.user.count({ where: { role: { in: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'SALES_REP'] }, status: 'ACTIVE' } }),
    db.deal.count({ where: { status: { in: ['NEW', 'TAKEN', 'IN_PROGRESS'] } } }),
    db.activityLog.count({ where: { createdAt: { gte: startOfToday() } } }),
  ])
  return {
    chat_id: chatId,
    text: `Система ROLF Dubai:\nАктивные сотрудники: ${activeManagers}\nОткрытые заявки: ${openLeads}\nДействий сегодня: ${todayActions}`,
    reply_markup: { inline_keyboard: [[{ text: 'Менеджеры', callback_data: 'menu:managers' }, { text: 'Метрики', callback_data: 'menu:metrics' }], [{ text: 'Owner', callback_data: 'menu:owner' }]] },
  }
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function helpText(role: string) {
  const base = ['/start — открыть Mini App', '/me — кто я']
  if (['OWNER', 'ADMIN'].includes(role)) {
    base.push('/metrics — быстрые метрики', '/managers — менеджеры', '/leads — заявки', '/settings — быстрые настройки')
  }
  if (role === 'OWNER') base.push('/owner — командный центр владельца')
  return base.join('\n')
}

function confirmationText(parsed: ParsedBotAction) {
  return `Я понял действие: ${intentLabel(parsed.intent)}.\nПараметры: ${JSON.stringify(parsed.params)}\nПодтвердить?`
}

function intentLabel(intent: string) {
  const labels: Record<string, string> = {
    manager_create: 'добавить менеджера',
    manager_status: 'изменить статус менеджера',
    manager_role_change: 'сменить роль',
    lead_status: 'изменить статус заявки',
    function_toggle: 'изменить функцию',
    metric_manual_entry: 'внести метрики вручную',
    owner_preview_role: 'включить просмотр роли',
    owner_impersonate: 'работать как пользователь',
  }
  return labels[intent] ?? intent
}

function publicRole(role: string) {
  return role === 'SALES_REP' ? 'MANAGER' : role
}

function roleLabel(role: string) {
  return {
    OWNER: 'Владелец',
    ADMIN: 'Администратор',
    SUPERVISOR: 'Руководитель',
    MANAGER: 'Менеджер',
    VIEWER: 'Просмотр',
  }[role] ?? role
}

function statusLabel(status: string) {
  return {
    ACTIVE: 'Активен',
    BLOCKED: 'Заблокирован',
    INVITED: 'Приглашён',
    DISABLED: 'Отключён',
  }[status] ?? status
}
