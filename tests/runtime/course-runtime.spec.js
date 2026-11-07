import { test, expect } from '@playwright/test';
import { env, api, login, key, cash, enrollment, evidence } from './support.js';
import { installEvidenceHooks } from './support.js';
installEvidenceHooks(test);

test('SYSTEM_CLOCK UI cash success survives GET failure; refresh never repeats POST', async ({ page, request }, info) => {
  const fixture = env.fixtures.cash;
  await login(page, 'reception', `/reception/courses?orderId=${fixture.orderId}&memberCode=${env.accounts.member.memberCode}`);
  await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/payments/cash')) posts++; });
  const pattern = `**/course-orders/${fixture.orderId}`;
  await page.route(pattern, route => route.abort('failed'));
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Đã ghi nhận thanh toán, chưa tải lại được dữ liệu.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true })).toHaveCount(0);
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'Cập nhật thanh toán', exact: true }).click();
  await expect(page.getByText('Đã thanh toán khóa học.', { exact: true })).toBeVisible();
  expect(posts).toBe(1);
  const e = await enrollment(request, fixture.runId); expect(e.lifecycleStatus).toBe('ACTIVE');
  await evidence(info, { clock: 'SYSTEM_CLOCK', cashPosts: posts, enrollment: e.enrollmentId });
});

test('SYSTEM_CLOCK UI uncertain cash retry preserves key and yields one enrollment', async ({ page, request }, info) => {
  const fixture = env.fixtures.withdraw;
  await login(page, 'reception', `/reception/courses?orderId=${fixture.orderId}&memberCode=${env.accounts.member.memberCode}`);
  const attempts = []; const pattern = '**/payments/cash';
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/payments/cash')) attempts.push(r.headers()['idempotency-key']); });
  await page.route(pattern, route => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Chưa xác nhận được kết quả thu tiền');
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toHaveLength(2); expect(attempts[0]).toBeTruthy(); expect(attempts[1]).toBe(attempts[0]);
  const list = await api(request, 'member', 'GET', '/members/me/course-enrollments');
  expect(list.filter(e => e.courseRunId === fixture.runId)).toHaveLength(1);
  await evidence(info, { attempts: 2, sameKey: true, enrollmentCount: 1, clock: 'SYSTEM_CLOCK' });
});

test('SYSTEM_CLOCK Manager reconciles through UI; owner, role, amount and replay enforced', async ({ page, request }, info) => {
  const f = env.fixtures.reconcile;
  await login(page, 'manager', '/manager/course-payments/reconcile');
  await page.getByLabel('Tìm đơn hoặc hội viên').fill(f.reference);
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.getByRole('button', { name: 'Đối soát', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(env.accounts.member.memberCode);
  await dialog.getByLabel('Số tiền thực nhận (VND)').fill('499999');
  await dialog.getByLabel('Nội dung chuyển khoản thực tế').fill(f.reference);
  await dialog.getByLabel('Mã giao dịch ngân hàng').fill('QA-UI-RECON');
  await dialog.getByLabel('Chứng từ đối soát').fill('Synthetic evidence; no real money');
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('QA isolated');
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Kiểm tra số tiền');
  await dialog.getByLabel('Số tiền thực nhận (VND)').fill('500000');
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await expect(dialog).toContainText('Hệ thống đã ghi nhận đăng ký khóa học.');
  const result = await api(request, 'member', 'GET', `/course-payments/${f.paymentId}/result`);
  expect(result.status).toBe('PAID'); expect(result.bankAccountNumber).toBeUndefined();
  await api(request, 'member2', 'GET', `/course-payments/${f.paymentId}/result`, undefined, 403);
  await api(request, 'coach', 'GET', `/course-payments/${f.paymentId}`, undefined, 403);
  const body = { status: 'PAID', receivedAmount: 500000, transferContent: f.reference, providerTransactionId: 'QA-UI-RECON', evidence: 'Synthetic evidence; no real money', reason: 'QA isolated' };
  const retryKey = key();
  const replay = await api(request, 'reception', 'POST', `/course-payments/${f.paymentId}/reconcile`, body, 200, retryKey);
  expect(replay.enrollment).toEqual(result.enrollment);
  await api(request, 'reception', 'POST', `/course-payments/${f.paymentId}/reconcile`, { ...body, providerTransactionId: 'OTHER' }, 409, retryKey);
  const inactive = await request.post(`${env.backendUrl}/auth/login`, { data: { identifier: 'inactive@course-qa.invalid', password: 'Qa-only-password-123!' } });
  expect([401,403]).toContain(inactive.status());
  await evidence(info, { owner: 200, otherMember: 403, coach: 403, conflictingReplay: 409, payment: result.status, clock: 'SYSTEM_CLOCK' });
});

test('SYSTEM_CLOCK Reception withdrawal and cancellation refresh all member panels without reload', async ({ page, request }, info) => {
  const fixture = env.fixtures.cash;
  // Own setup so this case can be run independently.
  let e = await enrollment(request, fixture.runId);
  if (!e) { await cash(request, fixture); e = await enrollment(request, fixture.runId); }
  await login(page, 'reception', `/reception/courses?orderId=${fixture.orderId}&memberCode=${env.accounts.member.memberCode}`);
  const row = page.getByRole('row').filter({ hasText: e.runCode });
  await row.getByRole('button', { name: 'Yêu cầu rút hộ', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Hội viên tạm ngừng học, giữ chỗ khi chờ duyệt');
  await dialog.getByLabel('Lý do', { exact: true }).fill('QA temporary withdrawal');
  await dialog.getByRole('button', { name: 'Xác nhận gửi yêu cầu' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Yêu cầu rút hộ', exact: true })).toBeDisabled();
  await expect(page.getByText('Tạm ngừng học/điểm danh, vẫn giữ chỗ.', { exact: true })).toBeVisible();
  const w = (await api(request, 'member', 'GET', '/members/me/course-withdrawal-requests')).find(w => w.enrollmentId === e.enrollmentId && w.status === 'PENDING');
  expect(w.requesterAccountId).toBe(env.accounts.reception.accountId);
  expect(w.snapshotSource).toBe('REQUEST_TIME'); expect(w.refundAmountVnd).toBe(400000);
  await page.getByRole('button', { name: 'Hủy yêu cầu rút', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/[Kk]hông/);
  await dialog.getByLabel('Lý do hủy').fill('QA return to class');
  await dialog.getByRole('button', { name: 'Xác nhận hủy yêu cầu' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Yêu cầu rút hộ', exact: true })).toBeEnabled();
  await expect(page.getByText('Tạm ngừng học/điểm danh, vẫn giữ chỗ.', { exact: true })).toHaveCount(0);
  const cancelled = await api(request, 'member', 'GET', `/members/me/course-withdrawal-requests/${w.id}`);
  expect(cancelled.status).toBe('CANCELLED'); expect(cancelled.cancelledByAccountId).toBe(env.accounts.reception.accountId);
  expect((await enrollment(request, fixture.runId)).sessions).toHaveLength(10);
  await evidence(info, { snapshot: 400000, createdByReception: true, cancelledByReception: true, sessionsUnchanged: 10 });
});



test('SYSTEM_CLOCK Member sees legacy missing snapshot as unknown with restored access', async ({ page, request }, info) => {
  const legacy = await api(request, 'member', 'GET', `/members/me/course-withdrawal-requests/${env.legacyRequestId}`);
  expect(legacy.status).toBe('CANCELLED'); expect(legacy.snapshotSource).toBe('UNAVAILABLE');
  expect(legacy.refundAmountVnd).toBeNull(); expect(legacy.canCancel).toBe(false);
  await login(page, 'member', '/member/courses/withdrawals');
  const card = page.locator('#withdrawals article').filter({ hasText: 'QA legacy historical request' });
  await expect(card).toContainText('Số tiền hoàn: Chưa xác định');
  await expect(card).toContainText('Thiếu thông tin khoản hoàn');
  await expect(card.getByRole('button', { name: 'Hủy yêu cầu rút' })).toHaveCount(0);
  expect((await enrollment(request, env.fixtures.legacy.runId)).lifecycleStatus).toBe('ACTIVE');
  await evidence(info, { clock: 'SYSTEM_CLOCK', legacy: 'initial synthetic historical fixture', snapshot: 'UNAVAILABLE', refund: null, enrollment: 'ACTIVE' });
});
