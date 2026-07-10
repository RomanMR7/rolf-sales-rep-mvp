import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

test('logs in through the current Mini App screen, restores the session, and logs out', async ({
  page,
  request,
}) => {
  const email = uniqueEmail()
  const displayName = 'Web E2E User'
  const backendUrl = process.env.E2E_BACKEND_URL

  if (!backendUrl) {
    throw new Error('E2E_BACKEND_URL is required')
  }

  const registerResponse = await request.post(`${backendUrl}/api/auth/register`, {
    data: {
      email,
      password: e2ePassword,
      displayName,
    },
    headers: {
      'X-Client-Platform': 'web',
    },
  })
  expect(registerResponse.status()).toBe(201)

  await page.goto('/')

  await expect(page.getByText('ROLF Sales App').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Demo email login' })).toBeVisible()
  await page.getByLabel('Demo email').fill(email)
  await page.getByLabel('Demo password').fill('wrong-password')
  await page.getByRole('button', { name: 'Войти как demo user' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()

  await page.getByLabel('Demo password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Войти как demo user' }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
  await expect(page.getByText('SALES_REP')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Клиенты' })).toBeVisible()
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === 'rolf_sales_rep_mvp_refresh' && cookie.httpOnly,
      ),
    )
    .toBe(true)

  const refreshAfterReload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') && response.request().method() === 'POST',
  )
  const meAfterReload = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/me') && response.request().method() === 'GET',
  )

  await page.reload()

  await expect((await refreshAfterReload).status()).toBe(200)
  await expect((await meAfterReload).status()).toBe(200)
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
  await expect(page.getByText('SALES_REP')).toBeVisible()

  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByText('ROLF Sales App').first()).toBeVisible()

  await page.getByLabel('Demo email').fill(email)
  await page.getByLabel('Demo password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Войти как demo user' }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()
})
