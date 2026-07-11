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
    return handleCallback(callback, db)
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

async function handleCallback(callback: NonNullable<TelegramUpdate['callback_query']>, db: DbClient) {
  const [action, id] = (callback.data ?? '').split(':')
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

async function executeConfirmedBotAction(tx: any, pending: { intent: string; payloadJson: unknown; actorUserId: string }) {
  const parsed = pending.payloadJson as ParsedBotAction
  const params = parsed.params ?? {}
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
  }
}

async function findUserForBotAction(tx: any, params: Record<string, unknown>) {
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
