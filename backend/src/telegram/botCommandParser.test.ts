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
