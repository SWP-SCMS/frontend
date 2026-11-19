import { test, expect } from '@playwright/test';

const membership = { paidPayments: 2, paidRevenue: 500000, completedRefundAmount: 600000, netRevenue: -100000, pendingPayments: 1, failedPayments: 1, pendingRefundAmount: 70000 };
const course = { paidPayments: 3, paidRevenue: 900000, completedRefundAmount: 100000, netRevenue: 800000, pendingPayments: 2, failedPayments: 0, pendingRefundAmount: 30000 };
const total = Object.fromEntries(Object.keys(membership).map(key => [key, membership[key] + course[key]]));
async function setup(page, report = { membership, course, total }) {
  const requests = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let data = [];
    if (path === '/auth/refresh') data = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'qa', role: 'MANAGER' })).toString('base64url')}.signature`, role: 'MANAGER', accountId: 'qa', fullName: 'QA' };
    if (path === '/staff/me/profile') data = { role: 'MANAGER', fullName: 'QA' };
    if (path === '/notifications') data = { content: [], unreadCount: 0 };
    if (path === '/manager/reports/revenue') { requests.push(url); data = report; }
    if (path === '/manager/dashboard') data = { centerRevenue: report, members: {}, bookings: {}, centerVisits: {} };
    await route.fulfill({ json: data });
  });
  return requests;
}

test('switch sources, refunds, negative net and inclusive Vietnam date filters', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/manager/reports/revenue');
  await expect(page.getByRole('heading', { name: 'Thu và hoàn tiền theo nguồn' })).toBeVisible();
  const netCard = page.locator('.card').filter({ hasText: 'Thu ròng sau hoàn tiền' });
  await expect(netCard).toContainText('700.000');
  await page.getByLabel('Nguồn thu').selectOption('membership');
  await expect(netCard).toContainText('-100.000');
  await expect(page.getByRole('heading', { name: 'Thu và hoàn tiền theo nguồn' })).toHaveCount(0);
  await page.getByLabel('Nguồn thu').selectOption('course');
  await expect(netCard).toContainText('800.000');
  await page.locator('#report-from').fill('01/11/2026');
  await page.locator('#report-to').fill('20/11/2026');
  await expect.poll(() => requests.at(-1)?.searchParams.get('from')).toBe('2026-10-31T17:00:00.000Z');
  await expect.poll(() => requests.at(-1)?.searchParams.get('to')).toBe('2026-11-20T17:00:00.000Z');
  await page.getByLabel('Gồm dữ liệu test').check();
  await expect.poll(() => requests.at(-1)?.searchParams.get('includeTestData')).toBe('true');
  await page.getByRole('button', { name: 'Đặt lại' }).click();
  await expect(page.getByLabel('Nguồn thu')).toHaveValue('total');
  await expect.poll(() => requests.at(-1)?.searchParams.has('from')).toBe(false);
  await expect.poll(() => requests.at(-1)?.searchParams.has('to')).toBe(false);
});

test('missing response fields show an error instead of false zero revenue', async ({ page }) => {
  await setup(page, {});
  await page.goto('/manager/reports/revenue');
  await expect(page.getByText('Không tải được báo cáo')).toBeVisible();
  await expect(page.getByText('Thu ròng sau hoàn tiền')).toHaveCount(0);
});

test('dashboard uses combined receipts and explains refunds are separate', async ({ page }) => {
  await setup(page);
  await page.goto('/manager/dashboard');
  const card = page.locator('.card').filter({ hasText: 'Tổng tiền đã thu' });
  await expect(card).toContainText('1.400.000');
  await expect(card).toContainText('chưa trừ hoàn tiền');
  await expect(card.locator('a')).toHaveAttribute('href', '/manager/reports/revenue');
});
