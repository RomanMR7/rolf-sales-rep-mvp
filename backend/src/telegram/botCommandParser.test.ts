import { describe, expect, test } from 'bun:test'

import { parseBotTextCommand } from './botCommandParser'

describe('bot command parser', () => {
  test('recognizes metrics commands', () => {
    expect(parseBotTextCommand('покажи метрики за сегодня')).toMatchObject({
      intent: 'metrics_summary',
      params: { period: 'today' },
      requiresConfirmation: false,
    })
    expect(parseBotTextCommand('метрики за неделю')).toMatchObject({
      intent: 'metrics_summary',
      params: { period: '7d' },
    })
  })

  test('recognizes manager role change commands as dangerous', () => {
    expect(parseBotTextCommand('поставь Ивану роль supervisor')).toMatchObject({
      intent: 'manager_role_change',
      params: { name: 'Иван', role: 'SUPERVISOR' },
      requiresConfirmation: true,
      riskLevel: 'high',
    })
  })

  test('recognizes manual metrics entry', () => {
    expect(parseBotTextCommand('Иван сегодня 10 лидов 3 успех 2 отмены сумма 50000')).toMatchObject({
      intent: 'metric_manual_entry',
      params: {
        managerName: 'Иван',
        leadsNew: 10,
        dealsSuccess: 3,
        dealsCancelled: 2,
        totalAmount: 50000,
      },
      requiresConfirmation: true,
    })
  })

  test('recognizes lead commands with confirmation', () => {
    expect(parseBotTextCommand('создай заявку клиент Dubai Marina сумма 250000 источник Telegram')).toMatchObject({
      intent: 'lead_create',
      params: { clientName: 'Dubai Marina', amount: 250000, source: 'Telegram' },
      requiresConfirmation: true,
    })
    expect(parseBotTextCommand('назначь заявку 018f4ce0-b643-7e05-a7c7-c5859aa4e102 на Иван')).toMatchObject({
      intent: 'lead_assign',
      params: { leadId: '018f4ce0-b643-7e05-a7c7-c5859aa4e102', managerName: 'Иван' },
      requiresConfirmation: true,
    })
    expect(parseBotTextCommand('закрой заявку 018f4ce0-b643-7e05-a7c7-c5859aa4e102')).toMatchObject({
      intent: 'lead_status',
      params: { leadId: '018f4ce0-b643-7e05-a7c7-c5859aa4e102', status: 'SUCCESS' },
      requiresConfirmation: true,
    })
  })

  test('recognizes owner preview and stop commands', () => {
    expect(parseBotTextCommand('покажи как менеджер')).toMatchObject({
      intent: 'owner_preview_role',
      params: { role: 'MANAGER' },
    })
    expect(parseBotTextCommand('выйти из режима роли')).toMatchObject({
      intent: 'owner_stop_mode',
    })
  })
})
