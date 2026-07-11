export type BotIntent =
  | 'metrics_summary'
  | 'manager_create'
  | 'manager_status'
  | 'manager_role_change'
  | 'manager_find'
  | 'lead_create'
  | 'lead_assign'
  | 'lead_status'
  | 'function_toggle'
  | 'metric_manual_entry'
  | 'owner_preview_role'
  | 'owner_impersonate'
  | 'owner_stop_mode'
  | 'unknown'

export type ParsedBotAction = {
  intent: BotIntent
  entity?: string
  params: Record<string, unknown>
  requiresConfirmation: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

const roleMap: Record<string, string> = {
  owner: 'OWNER',
  владелец: 'OWNER',
  admin: 'ADMIN',
  админ: 'ADMIN',
  администратор: 'ADMIN',
  supervisor: 'SUPERVISOR',
  руководитель: 'SUPERVISOR',
  manager: 'MANAGER',
  менеджер: 'MANAGER',
  viewer: 'VIEWER',
  просмотр: 'VIEWER',
}

export function parseBotTextCommand(text: string): ParsedBotAction {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const lower = normalized.toLowerCase()

  if (/метрик|сколько успешных сделок/.test(lower)) {
    const period = lower.includes('вчера') ? 'yesterday' : lower.includes('недел') ? '7d' : lower.includes('месяц') ? 'month' : 'today'
    const managerName = matchText(normalized, /(?:метрики|покажи метрики)\s+([A-Za-zА-Яа-яЁё\s]+)$/i)
    return action('metrics_summary', 'metrics', { period, managerName }, false, 'low')
  }

  let match = normalized.match(/добавь менеджера\s+(.+?)\s+telegram id\s+(\d+)/i)
  if (match) return action('manager_create', 'manager', { name: match[1], telegramId: match[2] }, true, 'medium')

  match = normalized.match(/(отключи|включи) менеджера\s+(.+)/i)
  if (match) return action('manager_status', 'manager', { name: match[2], status: match[1].toLowerCase() === 'отключи' ? 'DISABLED' : 'ACTIVE' }, true, 'high')

  match = normalized.match(/поставь\s+(.+?)\s+роль\s+([A-Za-zА-Яа-яЁё]+)/i)
  if (match) return action('manager_role_change', 'manager', { name: cleanupDativeName(match[1]), role: roleMap[match[2].toLowerCase()] ?? match[2].toUpperCase() }, true, 'high')

  match = normalized.match(/поставь пользователю\s+(\d+)\s+роль\s+([A-Za-zА-Яа-яЁё]+)/i)
  if (match) return action('manager_role_change', 'manager', { telegramId: match[1], role: roleMap[match[2].toLowerCase()] ?? match[2].toUpperCase() }, true, 'high')

  match = normalized.match(/найди менеджера\s+(.+)/i)
  if (match) return action('manager_find', 'manager', { name: match[1] }, false, 'low')

  match = normalized.match(/создай заявку клиент\s+(.+?)\s+сумма\s+(\d+(?:[.,]\d+)?)\s+источник\s+(.+)/i)
  if (match) return action('lead_create', 'lead', { clientName: match[1], amount: Number(match[2].replace(',', '.')), source: match[3] }, true, 'medium')

  match = normalized.match(/назначь заявку\s+(\S+)\s+на\s+(.+)/i)
  if (match) return action('lead_assign', 'lead', { leadId: match[1], managerName: match[2] }, true, 'medium')

  match = normalized.match(/(закрой|отмени) заявку\s+(\S+)(?:\s+(.+))?/i)
  if (match) return action('lead_status', 'lead', { leadId: match[2], status: match[1].toLowerCase() === 'закрой' ? 'SUCCESS' : 'CANCELLED', note: match[3] }, true, 'high')

  match = normalized.match(/(выключи|включи) функцию\s+(.+)/i)
  if (match) return action('function_toggle', 'function', { key: slugifyRussian(match[2]), enabled: match[1].toLowerCase() === 'включи' }, true, 'high')

  match = normalized.match(/(.+?)\s+(?:сегодня|за сегодня)\s+(\d+)\s+лидов\s+(\d+)\s+успех\s+(\d+)\s+отмены\s+сумма\s+(\d+(?:[.,]\d+)?)/i)
  if (match) return action('metric_manual_entry', 'metric', { managerName: match[1], period: 'today', leadsNew: Number(match[2]), dealsSuccess: Number(match[3]), dealsCancelled: Number(match[4]), totalAmount: Number(match[5].replace(',', '.')) }, true, 'medium')

  match = normalized.match(/добавь\s+(.+?)\s+(\d+)\s+лидов\s+за сегодня/i)
  if (match) return action('metric_manual_entry', 'metric', { managerName: match[1], period: 'today', leadsNew: Number(match[2]), mode: 'add' }, true, 'medium')

  match = normalized.match(/покажи как\s+([A-Za-zА-Яа-яЁё]+)/i)
  if (match) return action('owner_preview_role', 'owner_mode', { role: roleMap[match[1].toLowerCase()] ?? match[1].toUpperCase() }, true, 'medium')

  match = normalized.match(/работать как\s+(.+)/i)
  if (match) return action('owner_impersonate', 'owner_mode', { name: match[1] }, true, 'medium')

  if (/выйти из режима роли|выйти из режима/.test(lower)) {
    return action('owner_stop_mode', 'owner_mode', {}, false, 'low')
  }

  return action('unknown', undefined, { text: normalized }, false, 'low')
}

function action(
  intent: BotIntent,
  entity: string | undefined,
  params: Record<string, unknown>,
  requiresConfirmation: boolean,
  riskLevel: ParsedBotAction['riskLevel'],
): ParsedBotAction {
  return { intent, entity, params, requiresConfirmation, riskLevel }
}

function matchText(text: string, regex: RegExp) {
  return text.match(regex)?.[1]?.trim()
}

function cleanupDativeName(name: string) {
  return name.replace(/у$/i, '').trim()
}

function slugifyRussian(text: string) {
  return text.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_+|_+$/g, '')
}
