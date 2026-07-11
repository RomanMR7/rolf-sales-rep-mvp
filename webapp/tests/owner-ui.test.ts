import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

const root = join(import.meta.dir, '..')
const pages = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const routes = readFileSync(join(root, 'src/routes.tsx'), 'utf8')

test('owner command center and mode banners are wired into the Mini App', () => {
  expect(routes).toContain("path: '/app/owner'")
  expect(pages).toContain('Командный центр владельца')
  expect(pages).toContain('Быстро посмотреть как роль')
  expect(pages).toContain('Работать как пользователь')
  expect(pages).toContain('Вы смотрите приложение как')
  expect(pages).toContain('Режим владельца: вы работаете как')
  expect(pages).toContain('Выйти из режима')
})

test('manager preview does not receive admin-only function/script views', () => {
  expect(pages).toContain("auth.user.role === 'OWNER' || auth.user.role === 'ADMIN'")
  expect(pages).toContain("view === 'functions' && canAdmin")
  expect(pages).toContain("view === 'scripts' && canAdmin")
})

test('manager cards keep role change controls wired to the admin role endpoint', () => {
  expect(pages).toContain("queryKey: canManageUsers ? ['admin', 'users', 'managed-team'] : ['admin', 'managers']")
  expect(pages).toContain('updateAdminUserRole(manager.id, roleValue)')
  expect(pages).toContain('Сменить роль')
  expect(pages).toContain("const roleOptions = ['ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER']")
  expect(pages).toContain("queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })")
})

test('dashboard guide gives step-by-step instructions for every role', () => {
  for (const title of [
    'OWNER: владелец',
    'ADMIN: администратор',
    'SUPERVISOR: руководитель',
    'MANAGER: менеджер',
    'VIEWER: просмотр',
  ]) {
    expect(pages).toContain(title)
  }
  expect(pages).toContain('Нажмите "Владелец"')
  expect(pages).toContain('Нажмите "Менеджеры"')
  expect(pages).toContain('Нажмите "Заявки"')
  expect(pages).toContain('Кнопки управленческих действий')
})

test('dashboard and query screens expose retryable error states instead of endless loaders', () => {
  expect(pages).toContain('dashboard.isError')
  expect(pages).toContain('Дашборд не загрузился')
  expect(pages).toContain('function ErrorState')
  expect(pages).toContain('onRetry={() => void dashboard.refetch()}')
})
