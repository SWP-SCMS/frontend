import { test, expect } from '@playwright/test';

const pageOf = content => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, last: true });
async function mock(page, role, handle) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let response = await handle(path, url, route);
    if (response === 'handled') return;
    if (response === undefined) {
      if (path === '/auth/refresh') response = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'qa', role })).toString('base64url')}.signature`, role, accountId: 'qa', fullName: 'QA' };
      else if (path === '/members/me/profile') response = { accountId: 'qa', memberId: 'MB-QA', role, fullName: 'QA' };
      else if (path === '/staff/me/profile') response = { role, fullName: 'QA' };
      else if (path === '/notifications') response = { ...pageOf([]), unreadCount: 0 };
      else if (path === '/members/me/memberships') response = [{ id: 'membership', status: 'ACTIVE', benefitCodes: ['TRAINING_PLAN'], startsAt: '2026-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' }];
      else response = [];
    }
    await route.fulfill({ json: response });
  });
  return errors;
}

test('audit polls silently, keeps unapplied filters/details, and waits for a slow request', async ({ page }) => {
  await page.clock.install();
  let calls = 0, release, hold = false;
  const event = { id: 'audit-1', action: 'COURSE_CREATED', targetType: 'COURSE', createdAt: '2026-11-04T01:00:00Z', reason: 'QA audit', actorName: 'Manager QA' };
  const errors = await mock(page, 'MANAGER', async (path, url, route) => {
    if (path !== '/manager/audit-events') return;
    calls++;
    expect(url.searchParams.get('action')).toBeNull();
    if (hold) {
      await new Promise(resolve => { release = async () => { await route.fulfill({ json: pageOf([{ ...event, reason: 'QA updated' }]) }); resolve(); }; });
      return 'handled';
    }
    return pageOf([event]);
  });
  await page.goto('/manager/audit-events');
  await expect(page.getByText('Tạo khóa học', { exact: true }).last()).toBeVisible();
  await page.locator('summary').click();
  await page.locator('select[name="action"]').selectOption('COURSE_UPDATED');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const baseline = calls;
  hold = true;
  await page.clock.runFor(7000);
  await expect.poll(() => calls).toBe(baseline + 1);
  await expect(page.locator('table')).toBeVisible();
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await page.clock.runFor(21000);
  expect(calls).toBe(baseline + 1);
  await release();
  await expect(page.getByText('QA updated', { exact: false })).toBeVisible();
  await expect(page.locator('select[name="action"]')).toHaveValue('COURSE_UPDATED');
  expect(errors).toEqual([]);
});

test('course list refresh preserves a create form and never navigates/reloads the document', async ({ page }) => {
  await page.clock.install();
  let name = 'Khóa QA ban đầu', calls = 0, navigations = 0;
  const errors = await mock(page, 'MANAGER', path => {
    if (path === '/manager/courses') { calls++; return pageOf([{ id: 'course-1', code: 'QA', name, status: 'DRAFT' }]); }
    if (path.endsWith('/disciplines')) return [{ id: 'yoga', name: 'Yoga', status: 'ACTIVE' }];
  });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await page.goto('/manager/courses');
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole('button', { name: '+ Tạo khóa học' }).click();
  await page.getByLabel('Tên khóa học *', { exact: true }).fill('Bản nháp chưa lưu');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  name = 'Khóa QA mới';
  const baseline = calls;
  const navigationBaseline = navigations;
  await page.clock.runFor(7000);
  await expect.poll(() => calls).toBeGreaterThan(baseline);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên khóa học *', { exact: true })).toHaveValue('Bản nháp chưa lưu');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(navigations).toBe(navigationBaseline);
  expect(errors).toEqual([]);
});

test('member QR switches to paid automatically using only status GETs', async ({ page }) => {
  await page.clock.install();
  let status = 'PENDING_PAYMENT';
  const errors = await mock(page, 'MEMBER', path => {
    if (path === '/course-runs/run-1') return { id: 'run-1', courseName: 'Khóa QA', registrationStatus: 'OPEN', sessions: [] };
    if (path === '/members/me/course-orders/order-1') return { orderId: 'order-1', orderReference: 'QA-ORDER', orderStatus: status, tuitionVnd: 1000, expiresAt: '2030-01-01T00:00:00Z', payment: { bankCode: 'QA BANK', amount: 1000 } };
  });
  await page.goto('/member/courses/run-1/register?orderId=order-1');
  await expect(page.getByText('QA BANK', { exact: true })).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  status = 'PAID';
  await page.clock.runFor(7000);
  await expect(page.getByRole('heading', { name: 'Thanh toán đã được xác nhận' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('member receives new training data without closing the expanded version', async ({ page }) => {
  await page.clock.install();
  let title = 'Giáo án QA';
  const errors = await mock(page, 'MEMBER', path => {
    if (path === '/members/me/training-plans') return [{ id: 'plan-1', title, status: 'ACTIVE', versions: [{ id: 'v1', versionNumber: 1, content: 'Bài tập QA' }] }];
  });
  await page.goto('/member/training-plans');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Phiên bản 1' }).click();
  await expect(page.getByText('Bài tập QA')).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  title = 'Giáo án được HLV cập nhật';
  await page.clock.runFor(7000);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Bài tập QA')).toBeVisible();
  expect(errors).toEqual([]);
});
