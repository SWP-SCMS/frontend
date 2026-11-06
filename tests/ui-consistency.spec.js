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


test('assigned members: failure is not empty and retry recovers', async ({ page }) => {
  let failed = true;
  await mock(page, 'COACH', async (path, url, route) => {
    if (path !== '/coach/members') return;
    if (failed) { await route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } }); return 'handled'; }
    return pageOf([]);
  });
  await page.goto('/coach/members');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await expect(page.getByText('Chưa có hội viên được phân công', { exact: true })).toHaveCount(0);
  await expect(page.getByText('INTERNAL_ERROR', { exact: true })).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Chưa có hội viên được phân công', { exact: true })).toBeVisible();
});

test('session results save, update and retain draft across polling; feedback links result', async ({ page }) => {
  await page.clock.install();
  let result = null, feedback = null;
  const writes = [];
  const base = '/coach/class-sessions/session-1/members/member-1';
  await mock(page, 'COACH', async (path, url, route) => {
    if (path === '/coach/class-sessions/session-1') return { id: 'session-1', classType: 'GROUP', className: 'Yoga QA', startTime: '2026-11-01T01:00:00Z', members: [{ memberId: 'member-1', fullName: 'Hội viên QA' }] };
    if (!path.startsWith(base)) return;
    const isResult = path.includes('/training-results');
    if (route.request().method() === 'GET') {
      const value = isResult ? result : feedback;
      if (!value) { await route.fulfill({ status: 204 }); return 'handled'; }
      return value;
    }
    const payload = route.request().postDataJSON();
    writes.push({ path, method: route.request().method(), payload });
    if (isResult) { result = { id: 'result-1', ...payload }; return result; }
    feedback = { id: 'feedback-1', ...payload }; return feedback;
  });
  await page.goto('/coach/schedule/session-1/members/member-1/training');
  const resultInput = page.getByLabel('Kết quả tập luyện', { exact: true });
  await expect(resultInput).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Lưu nhận xét', exact: true })).toBeDisabled();
  await resultInput.fill('Hoàn thành ba hiệp');
  await page.clock.runFor(8000);
  await expect(resultInput).toHaveValue('Hoàn thành ba hiệp');
  await page.getByRole('button', { name: 'Lưu kết quả tập luyện' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  expect(writes[0].method).toBe('POST');
  expect(writes[0].payload.activityAt).toBe('2026-11-01T01:00:00Z');
  await resultInput.fill('Hoàn thành bốn hiệp');
  await page.getByRole('button', { name: 'Lưu kết quả tập luyện' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].method).toBe('PUT');
  await page.getByLabel('Nhận xét', { exact: true }).fill('Tiến bộ tốt');
  await page.getByRole('button', { name: 'Lưu nhận xét', exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].payload.trainingResultId).toBe('result-1');
  await page.reload();
  await expect(resultInput).toHaveValue('Hoàn thành bốn hiệp');
  await expect(page.getByLabel('Nhận xét', { exact: true })).toHaveValue('Tiến bộ tốt');
});

for (const [role, path, heading] of [
  ['MEMBER', '/member/courses', 'Khóa học của tôi'],
  ['MANAGER', '/manager/courses', 'Danh mục khóa học'],
  ['RECEPTIONIST', '/reception/courses', 'Đăng ký khóa học'],
]) {
  test(`sample layout ${role}: mobile and desktop`, async ({ page }) => {
    const errors = await mock(page, role, path => {
      if (path === '/members/me/course-refunds') return { items: [], page: 0, totalPages: 0 };
      if (path === '/manager/courses' || path === '/course-runs') return pageOf([]);
    });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: `test-results/ui-${role.toLowerCase()}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('verify email: failed change clears old success and preserves current email', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('scms.pendingEmailVerification', JSON.stringify({ email: 'old@example.com', csrfToken: 'qa-csrf' })));
  let calls = 0;
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/email-verification/change-email')) {
      calls++;
      await route.fulfill(calls === 1 ? { json: { maskedEmail: 'n***@example.com' } } : { status: 409, json: { code: 'EMAIL_ALREADY_EXISTS' } });
    } else await route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/verify-email');
  await expect(page.locator('#verify-email')).toHaveAttribute('readonly', '');
  await page.locator('summary').click();
  const change = page.locator('input[name="newEmail"]');
  await change.fill('new@example.com');
  await page.getByRole('button', { name: 'Đổi email và gửi OTP mới' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await change.fill('taken@example.com');
  await page.getByRole('button', { name: 'Đổi email và gửi OTP mới' }).click();
  await expect(page.getByText('Email này đã được sử dụng.', { exact: true })).toBeVisible();
  await expect(page.locator('.alert-success')).toHaveCount(0);
  await expect(page.locator('#verify-email')).toHaveValue('new@example.com');
});

test('membership requests separate tabs, preserve filters and hide direct cancellation on freeze', async ({ page }) => {
  const common = { memberAccountId: 'member', memberId: 'MB-1', memberFullName: 'Test Member', createdAt: '2026-11-01T00:00:00Z', version: 0 };
  const errors = await mock(page, 'MANAGER', (path, url) => {
    if (path === '/manager/membership-termination-requests') {
      return { ...pageOf(url.searchParams.get('page') === '1'
        ? [{ ...common, id: 't2', status: 'REJECTED', reason: 'Older rejected request', mode: 'IMMEDIATE' }]
        : [{ ...common, id: 't1', status: 'PENDING', reason: 'Cancel request', mode: 'END_OF_CYCLE' }]), totalPages: 2 };
    }
    if (path === '/manager/membership-freeze-requests') return pageOf([
      { ...common, id: 'f1', status: 'ACTIVE', reason: 'Freeze request', startDate: '2026-11-01', endDate: '2026-12-01', feeAmount: 100000 },
    ]);
  });
  await page.goto('/manager/membership-requests');
  await expect(page.getByRole('heading', { name: 'Yêu cầu hủy gói', exact: true })).toBeVisible();
  await expect(page.getByText('Hủy trực tiếp theo quyết định quản lý')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tạo yêu cầu hủy', exact: true }).click();
  await expect(page.getByText('Hủy trực tiếp theo quyết định quản lý')).toBeVisible();
  await page.getByRole('combobox', { name: 'Lọc trạng thái hủy gói' }).selectOption('REJECTED');
  await expect(page.getByText('Older rejected request')).toBeVisible();
  await expect(page.getByText('Cancel request', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Đóng băng', exact: true }).click();
  await expect(page).toHaveURL(/tab=freeze/);
  await expect(page.getByText('Hủy trực tiếp theo quyết định quản lý')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu hủy', exact: true })).toHaveCount(0);
  await expect(page.getByText('Freeze request', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Lọc trạng thái đóng băng' }).selectOption('PENDING');
  await expect(page.getByText('Không có yêu cầu phù hợp.')).toBeVisible();
  await page.getByRole('tab', { name: 'Hủy gói', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Lọc trạng thái hủy gói' })).toHaveValue('REJECTED');
  await page.getByRole('tab', { name: 'Đóng băng', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Đóng băng', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('catalog and refund badges use the shared semantic palette', async ({ page }) => {
  await mock(page, 'MANAGER', path => {
    if (path === '/manager/courses') return pageOf([
      { id: 'c1', code: 'C1', name: 'Published course', status: 'PUBLISHED', defaultMinimumEnrollment: 1 },
      { id: 'c2', code: 'C2', name: 'Draft course', status: 'DRAFT', defaultMinimumEnrollment: 1 },
    ]);
    if (path === '/manager/course-refund-obligations') return { totalPages: 1, items: [
      { id: 'r1', memberName: 'Member', memberCode: 'MB1', status: 'COMPLETED', grossObligationVnd: 100, source: 'MEMBER_WITHDRAWAL' },
      { id: 'r2', memberName: 'Member', memberCode: 'MB1', status: 'APPROVED', grossObligationVnd: 100, source: 'MEMBER_WITHDRAWAL' },
    ] };
  });
  await page.goto('/manager/courses');
  const published = page.locator('.system-badge').filter({ hasText: 'Đã công bố' });
  await expect(published).toHaveCSS('background-color', 'rgb(220, 252, 231)');
  await expect(published).toHaveCSS('color', 'rgb(22, 101, 52)');
  await expect(published).toHaveCSS('font-weight', '600');
  await page.goto('/manager/course-refunds');
  await expect(page.locator('.system-badge').filter({ hasText: 'Đã xác minh hoàn tất' })).toHaveCSS('background-color', 'rgb(220, 252, 231)');
  await expect(page.locator('.system-badge').filter({ hasText: 'Đã duyệt, chưa ghi nhận chi' })).toHaveCSS('background-color', 'rgb(219, 234, 254)');
});
