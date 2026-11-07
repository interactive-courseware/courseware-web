import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

function credentials() { return JSON.parse(readFileSync('../../.local/e2e/credentials.json', 'utf8')) }
async function login(page: Page) {
  const user = credentials()
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(user.username)
  await page.getByLabel('密码', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: '进入学习空间' }).click()
  await expect(page).toHaveURL(/\/catalog$/)
  await expect(page.locator('.course-card')).toHaveCount(1)
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy()
}

test('login, catalog, search, lesson interaction and protected downloads', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/login')
  await noOverflow(page)
  await login(page)
  await noOverflow(page)
  mkdirSync(resolve('../../.local/screenshots'), { recursive: true })
  await page.screenshot({ path: resolve(`../../.local/screenshots/catalog-${info.project.name}.png`), fullPage: true })
  await page.getByLabel('搜索课程、章节或制作人').fill('斜率')
  await expect(page.locator('.course-card')).toHaveCount(1)
  await page.getByRole('button', { name: '已发布课时', exact: true }).click()
  await expect(page.locator('.search-lesson')).toHaveCount(1)
  await page.getByLabel('清除搜索').click()
  await page.locator('.course-card').click()
  await expect(page.getByRole('heading', { name: '把变化画出来', exact: true })).toBeVisible()
  await expect(page.locator('.detail-lesson')).toHaveCount(3)
  await expect(page.locator('.detail-lesson.planned')).not.toHaveAttribute('href')
  await noOverflow(page)
  await page.locator('a.detail-lesson').filter({ hasText: '亲手改变一条直线' }).click()
  await expect(page).toHaveURL(/\/releases\/.*\/lessons\/lab\/experiment\/web\/index.html/)
  await page.locator('#slope').fill('2')
  await page.locator('#intercept').fill('1')
  await expect(page.locator('#equation')).toHaveText('y = 2x + 1')
  const pixels = await page.locator('#plot').evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
    return data.some((value, index) => index % 4 === 3 && value > 0)
  })
  expect(pixels).toBe(true)
  await noOverflow(page)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /下载 y/ }).click()
  expect((await download).suggestedFilename()).toBe('line-example.csv')
  const protectedUrl = page.url()
  await page.goto('/catalog')
  if (info.project.name === 'mobile') await page.getByRole('button', { name: '打开导航' }).click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login/)
  const response = await page.request.get(protectedUrl)
  expect(response.status()).toBe(401)
  expect(errors).toEqual([])
})

test('administrator creates an independent member and first login requires a new password', async ({ page, browser }, info) => {
  await login(page)
  await page.goto('/admin/users')
  await page.getByRole('button', { name: '新增成员', exact: true }).first().click()
  const username = `member-${info.project.name}`
  const password = 'browser-test-password-2468'
  await page.getByLabel('用户名', { exact: true }).fill(username)
  await page.getByLabel('展示名称').fill(`测试成员 ${info.project.name}`)
  await page.getByLabel('初始密码').fill(password)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  await noOverflow(page)
  const memberContext = await browser.newContext({ baseURL: 'http://localhost:58174' })
  const member = await memberContext.newPage()
  await member.goto('/login')
  await member.getByLabel('用户名', { exact: true }).fill(username)
  await member.getByLabel('密码', { exact: true }).fill(password)
  await member.getByRole('button', { name: '进入学习空间' }).click()
  await expect(member).toHaveURL(/\/password$/)
  await member.getByLabel('当前密码').fill(password)
  await member.getByLabel('新密码', { exact: true }).fill(password + '-changed')
  await member.getByLabel('确认新密码').fill(password + '-changed')
  await member.getByRole('button', { name: '更新密码' }).click()
  await expect(member).toHaveURL(/changed=1/)
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  await memberContext.close()
})

test('catalog and login meet core accessibility checks', async ({ page }) => {
  await page.goto('/login')
  const loginResult = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(loginResult.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
  await login(page)
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
})

test('course sync works without secure-context randomUUID', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  })
  await login(page)
  await page.goto('/admin/courses')
  await page.getByRole('button', { name: '接入课程', exact: true }).first().click()
  const slug = `http-sync-${info.project.name}`
  await page.getByLabel('课程标识').fill(slug)
  await page.getByLabel('Git 仓库地址').fill('https://github.com/example/course.git')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const keys: string[] = []
  await page.route('**/api/v1/admin/courses/*/sync', async route => {
    keys.push(route.request().headers()['idempotency-key'] || '')
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' })
  })
  const button = page.getByRole('row').filter({ hasText: slug }).getByRole('button', { name: '同步', exact: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    await button.click()
    await expect(page.getByRole('status')).toContainText('更新任务已加入队列')
    await expect(button).toBeEnabled()
  }
  expect(keys).toHaveLength(2)
  expect(keys.every(key => /^[a-f0-9]{32}$/.test(key))).toBe(true)
  expect(new Set(keys).size).toBe(2)
})
