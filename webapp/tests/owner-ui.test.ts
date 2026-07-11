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
