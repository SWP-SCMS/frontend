import { test, expect } from '@playwright/test';

async function setup(page, role, handler) {
  const calls = [];
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    calls.push({ path, search: url.search, method: req.method() });
    let body = handler(path, req);
    if (body === undefined) {
      if (path === '/auth/refresh') body = { accessToken: 'mock.' + Buffer.from(JSON.stringify({ sub: 'qa', role })).toString('base64url') + '.signature', role, accountId: 'qa', fullName: 'QA' };
      else if (path.endsWith('/profile')) body = { fullName: 'QA', role };
      else if (path === '/notifications') body = { content: [], unreadCount: 0 };
      else body = [];
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

test('Reception keeps the member profile when the course lookup is unavailable', async ({ page }) => {
  await setup(page, 'RECEPTIONIST', path => path === '/reception/members/search'
    ? { accountId: 'qa-member', memberId: 'MB-QA', fullName: 'Hội viên QA', status: 'ACTIVE' }
    : undefined);
  await page.route('**/center-visits/course-admission', route => route.fulfill({ status: 404 }));
  await page.goto('/reception/check-in');
  await page.getByLabel('Mã hội viên hoặc số điện thoại').fill('0927927901');
  await page.getByRole('button', { name: 'Tìm hội viên' }).click();
  await expect(page.getByRole('heading', { name: 'Hội viên QA' })).toBeVisible();
  await expect(page.getByText(/Chưa kiểm tra được buổi khóa học/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận check-in' })).toBeDisabled();
});

test('T14 reconciliation has distinct columns and inline validation', async ({ page }) => {
  await setup(page, 'MANAGER', path => path === '/payments/reconciliation-queue' ? { content: [{ paymentId: 'p1', paymentReference: 'SCMS-ORD-1', orderNumber: 'ORD-1', memberName: 'QA', transferContent: 'SCMS-ORD-1', amount: 1000, expiresAt: '2099-01-01T00:00:00Z' }], totalPages: 1 } : undefined);
  await page.goto('/manager/payments/reconcile');
  await expect(page.getByRole('columnheader', { name: 'Mã thanh toán' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xác nhận đã nhận tiền', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.alert-warning')).toHaveCount(0);
  await expect(dialog.locator('.form-text')).toHaveCount(0);
  await page.locator('#rec-reason').fill('a');
  await page.locator('#rec-evidence').click();
  await expect(page.locator('#rec-reason')).toHaveClass(/is-invalid/);
  await expect(dialog.getByRole('button', { name: 'Xác nhận đã thanh toán' })).toBeDisabled();
});

test('T14 uploads evidence and fills its source without reconciling payment', async ({ page }) => {
  const calls = await setup(page, 'MANAGER', (path, req) => {
    if (path === '/payments/reconciliation-queue') return { content: [{ paymentId: 'p1', orderNumber: 'QA-1', memberName: 'QA', amount: 1000 }], totalPages: 1 };
    if (path === '/payments/p1/evidence-images') return req.method() === 'POST' ? { id: 'image1' } : [];
  });
  await page.goto('/manager/payments/reconcile');
  await page.getByRole('button', { name: 'Xác nhận đã nhận tiền', exact: true }).click();
  await page.getByLabel('Ảnh chứng từ đối soát', { exact: true }).setInputFiles('tests/fixtures/reconciliation-evidence.png');
  await expect(page.getByRole('button', { name: 'Xem chứng từ 1', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nguồn chứng từ đối chiếu', { exact: true })).toHaveValue('Đối chiếu ảnh chứng từ đã đính kèm giao dịch.');
  expect(calls.filter(c => c.path.endsWith('/evidence-images') && c.method === 'POST')).toHaveLength(1);
  expect(calls.filter(c => c.path.endsWith('/reconcile'))).toHaveLength(0);
});

test('T15 plan filter reaches backend, resets page and survives reload', async ({ page }) => {
  const calls = await setup(page, 'MANAGER', path => {
    if (path === '/manager/membership-plans') return [{ code: 'PRE001', displayName: 'Premium' }];
    if (path === '/manager/members') return { content: [{ accountId: 'm1', fullName: 'QA', activePlanCode: 'PRE001', status: 'ACTIVE' }], totalPages: 3, totalElements: 41 };
  });
  await page.goto('/manager/members?page=2');
  await page.getByLabel('Gói đang dùng', { exact: true }).selectOption('PRE001');
  await expect(page).toHaveURL(/planCode=PRE001$/);
  await expect(page.locator('tbody')).toContainText('Premium');
  await page.reload();
  await expect(page.getByLabel('Gói đang dùng', { exact: true })).toHaveValue('PRE001');
  expect(calls.some(c => c.path === '/manager/members' && c.search.includes('planCode=PRE001') && c.search.includes('page=0'))).toBe(true);
});

test('T19 cancellation preview is read-only and requires a valid reason', async ({ page }) => {
  const calls = await setup(page, 'MANAGER', path => {
    if (path === '/manager/course-runs/qa') return { id: 'qa', courseName: 'Khóa QA', runCode: 'QA-19', status: 'DRAFT', capacity: 10, minimumEnrollment: 1, totalUnits: 1, version: 2 };
    if (path.endsWith('/cancellation-impact')) return { enrollmentCount: 3, pendingOrderCount: 2 };
  });
  await page.goto('/manager/course-runs/qa');
  await page.getByRole('button', { name: 'Hủy đợt mở', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.course-run-cancel-impact dt')).toHaveText(['Đăng ký bị ảnh hưởng', 'Đơn chờ thanh toán']);
  await expect(dialog.locator('.course-run-cancel-impact dd')).toHaveText(['3', '2']);
  await expect(dialog).toContainText('Hoàn 100% giá trị các buổi chưa được tổ chức');
  await dialog.getByRole('button', { name: 'Xác nhận hủy đợt học' }).click();
  await expect(dialog).toContainText('Lý do cần ít nhất 5 ký tự.');
  await dialog.getByRole('button', { name: 'Giữ đợt học', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls.filter(c => c.path.endsWith('/cancel'))).toHaveLength(0);
});

test('T21 radio attendance, mark all and unsaved navigation guard', async ({ page }) => {
  const start = new Date(Date.now() - 60000).toISOString();
  const end = new Date(Date.now() + 3600000).toISOString();
  await setup(page, 'COACH', path => {
    if (path === '/coach/class-sessions/qa') return { id: 'qa', className: 'Lớp QA', startTime: start, endTime: end, capacity: 2, status: 'IN_PROGRESS', members: [{ memberId: 'm1', fullName: 'HV QA', memberCode: 'MB-QA' }, { memberId: 'm2', fullName: 'HV tại quầy', memberCode: 'MB-QB' }] };
    if (path === '/coach/class-sessions/qa/attendance') return [{ id: 'a1', memberId: 'm1', receptionistCheckedIn: true, status: 'NOT_RECORDED' }, { id: 'a2', memberId: 'm2', receptionistCheckedIn: false, status: 'NOT_RECORDED' }];
  });
  await page.goto('/coach/schedule/qa/attendance');
  const eligible = page.getByRole('row').filter({ hasText: 'MB-QA' });
  const waiting = page.getByRole('row').filter({ hasText: 'MB-QB' });
  await expect(waiting.getByRole('radio', { name: 'Có mặt' })).toBeDisabled();
  await expect(waiting.getByRole('radio', { name: 'Vắng' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tất cả có mặt', exact: true }).click();
  await expect(eligible.getByRole('radio', { name: 'Có mặt', exact: true })).toBeChecked();
  await eligible.getByRole('radio', { name: 'Vắng', exact: true }).check();
  await expect(eligible.getByRole('radio', { name: 'Có mặt', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Quay lại lịch phụ trách' }).click();
  await expect(page.getByRole('dialog')).toContainText('1 thay đổi chưa lưu');
  await page.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(eligible.getByRole('radio', { name: 'Vắng', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Quay lại lịch phụ trách' }).click();
  await page.getByRole('button', { name: 'Bỏ thay đổi và rời trang' }).click();
  await expect(page).toHaveURL(/\/coach\/schedule$/);
});
