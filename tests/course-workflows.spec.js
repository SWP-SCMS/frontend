import { test, expect } from '@playwright/test';

const run = { id: 'run-1', courseName: 'Yoga nền tảng', courseCode: 'YOGA', runCode: 'YOGA-01', status: 'COMPLETED', primaryCoachName: 'Huấn luyện viên An' };
const member = { accountId: 'member-1', memberId: 'MB-001', fullName: 'Nguyễn Minh An', role: 'MEMBER' };
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const enrollment = { enrollmentId: 'enrollment-1', courseRunId: run.id, courseName: run.courseName, courseCode: run.courseCode, runCode: run.runCode, lifecycleStatus: 'ACTIVE', enrolledAt: yesterday, sessions: [{ enrollmentSessionId: 'enrollment-session-1', courseSessionId: 'session-1', unitNumber: 1, startAt: nextMonth, endAt: nextMonth, disposition: 'ENROLLED', attendanceStatus: 'NOT_RECORDED' }] };
const refund = { memberName: member.fullName, memberCode: member.memberId, courseName: run.courseName, runCode: run.runCode, id: 'refund-1', memberAccountId: member.accountId, courseRunId: run.id, enrollmentId: enrollment.enrollmentId, source: 'MEMBER_WITHDRAWAL', status: 'PENDING_REVIEW', grossObligationVnd: 700000, approvedAmountVnd: null, disbursedAmountVnd: null, verifiedAmountVnd: null, version: 3, createdAt: yesterday, requestReason: 'Đổi lịch làm việc' };
const pageOf = (items) => ({ items, page: 0, size: 20, totalElements: items.length, totalPages: items.length ? 1 : 0 });

async function mockApi(page, role, handler) {
  const calls = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /TypeError|ErrorBoundary/.test(message.text())) errors.push(message.text()); });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()) : undefined;
    const call = { path, method, body, url, headers: request.headers() };
    calls.push(call);
    let result = await handler?.(call);
    if (result === undefined) {
      if (path === '/auth/refresh') result = { body: { accessToken: 'mock.' + Buffer.from(JSON.stringify({ sub: 'test-account', role })).toString('base64url') + '.signature', role, accountId: 'test-account', fullName: 'Tài khoản kiểm thử' } };
      else if (path === '/notifications') result = { body: { content: [], page: 0, size: 20, totalPages: 0, totalElements: 0, unreadCount: 0 } };
      else if (path === '/staff/me/profile') result = { body: { fullName: 'Tài khoản kiểm thử', role } };
      else if (path === '/manager/members/member-1' || path === '/members/me/profile') result = { body: member };
      else if (path === '/manager/course-runs/run-1') result = { body: run };
      else if (path === '/members/me/course-enrollments') result = { body: [enrollment] };
      else if (['/members/me/memberships', '/membership-offers', '/members/me/course-waitlists', '/members/me/course-withdrawal-requests', '/members/me/course-schedule-changes', '/members/me/course-transfer-offers'].includes(path)) result = { body: [] };
      else if (path === '/members/me/course-refund-obligations') result = { body: pageOf([]) };
      else if (path === '/course-runs') result = { body: { content: [], page: 0, size: 100, totalPages: 0, totalElements: 0 } };
      else result = { status: 404, body: { code: 'TEST_UNMOCKED_ENDPOINT' } };
    }
    await route.fulfill({ status: result.status || 200, contentType: 'application/json', body: JSON.stringify(result.body) });
  });
  return { calls, errors };
}

test('manager reviews named refund, submits version, and sees approval without payment completion', async ({ page }) => {
  let current = { ...refund };
  const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
    if (path === '/manager/course-refund-obligations') return { body: pageOf([current]) };
    if (path === '/manager/course-refund-obligations/refund-1') return { body: current };
    if (path.endsWith('/refund-1/approve') && method === 'POST') {
      expect(body).toEqual({ reason: 'Đã kiểm tra hồ sơ', expectedVersion: 3 });
      current = { ...current, status: 'APPROVED', approvedAmountVnd: 700000, version: 4 };
      return { body: current };
    }
  });
  await page.goto('/manager/course-refunds');
  await page.getByRole('button', { name: 'Xem hồ sơ' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(member.fullName);
  await expect(dialog).toContainText(run.runCode);
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill(' Đã kiểm tra hồ sơ ');
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: test.info().outputPath('manager-refund.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Xác nhận duyệt' }).click();
  await expect(dialog).toContainText('Đã duyệt, chưa ghi nhận chi');
  await expect(dialog.getByRole('button', { name: 'Xác minh hoàn tất', exact: true })).toHaveCount(0);
  expect(calls.filter((call) => call.path.endsWith('/approve'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('refund verification reports evidence conflict and retries with the same version', async ({ page }) => {
  let current = { ...refund, status: 'DISBURSEMENT_RECORDED', approvedAmountVnd: 700000, disbursedAmountVnd: 700000, disbursedAt: yesterday, disbursementMethod: 'BANK_TRANSFER', disbursementReference: 'TX-01', evidenceReference: 'DOC-01', version: 5 };
  const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
    if (path === '/manager/course-refund-obligations') return { body: pageOf([current]) };
    if (path === '/manager/course-refund-obligations/refund-1') return { body: current };
    if (path.endsWith('/verify') && method === 'POST') {
      if (body.evidenceReference !== 'DOC-01') return { status: 409, body: { code: 'COURSE_REFUND_EVIDENCE_MISMATCH' } };
      expect(body).toEqual({ amountVnd: '700000', disbursementReference: 'TX-01', evidenceReference: 'DOC-01', reason: 'Đối chiếu xong', expectedVersion: 5 });
      current = { ...current, status: 'COMPLETED', verifiedAmountVnd: 700000, version: 7 };
      return { body: current };
    }
  });
  await page.goto('/manager/course-refunds?id=refund-1');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác minh hoàn tất', exact: true }).click();
  await dialog.getByLabel('Số tiền đã đối chiếu (VND)').fill('700000');
  await dialog.getByLabel('Mã tham chiếu khoản chi').fill('TX-01');
  await dialog.getByLabel('Tham chiếu chứng từ', { exact: true }).fill('WRONG');
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('Đối chiếu xong');
  await dialog.getByRole('button', { name: 'Xác nhận xác minh hoàn tất' }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'không khớp' })).toBeVisible();
  await dialog.getByLabel('Tham chiếu chứng từ', { exact: true }).fill('DOC-01');
  await dialog.getByRole('button', { name: 'Xác nhận xác minh hoàn tất' }).click();
  await expect(dialog).toContainText('Đã xác minh hoàn tất');
  expect(calls.filter((call) => call.path.endsWith('/verify'))).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('withdrawal decision sends reason only and uses the returned refund including zero', async ({ page }) => {
  let current = { id: 'withdraw-1', memberAccountId: member.accountId, courseRunId: run.id, status: 'PENDING', requestReason: 'Xin rút', requestedAt: yesterday, refundAmountVnd: null };
  const { errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
    if (path === '/manager/course-withdrawal-requests') return { body: [current] };
    if (path === '/manager/course-withdrawal-requests/withdraw-1') return { body: current };
    if (path.endsWith('/withdraw-1/approve') && method === 'POST') {
      expect(body).toEqual({ reason: 'Duyệt rút theo yêu cầu' });
      current = { ...current, status: 'APPROVED', refundAmountVnd: 0, remainingUnits: 1, totalUnits: 10 };
      return { body: current };
    }
  });
  await page.goto('/manager/course-withdrawals?id=withdraw-1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Chưa xác định');
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('Duyệt rút theo yêu cầu');
  await dialog.getByRole('button', { name: 'Xác nhận duyệt' }).click();
  await expect(dialog).toContainText('Đã duyệt rút');
  await expect(dialog).toContainText('0 ₫');
  expect(errors).toEqual([]);
});

test('manager chooses a transfer target supplied by backend', async ({ page }) => {
  let current = { id: 'request-1', memberAccountId: member.accountId, sourceRunId: run.id, status: 'PENDING', requestedAt: yesterday };
  const { errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
    if (path === '/manager/course-transfer-requests') return { body: [current] };
    if (path.endsWith('/request-1/targets')) return { body: [{ runId: 'target-1', courseName: 'Yoga tối', runCode: 'YOGA-02', tuitionVnd: 900000, capacity: 20, usedSeats: 10 }] };
    if (path.endsWith('/request-1/approve') && method === 'POST') {
      expect(body).toEqual({ targetRunId: 'target-1', reason: 'Phù hợp lịch mới' });
      current = { ...current, status: 'OFFERED' };
      return { body: { id: 'offer-1', status: 'OFFERED' } };
    }
  });
  await page.goto('/manager/course-transfers?id=request-1');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await dialog.getByLabel('Đợt học thay thế').selectOption('target-1');
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('Phù hợp lịch mới');
  await dialog.getByRole('button', { name: 'Xác nhận duyệt' }).click();
  await expect(dialog).toContainText('Đã gửi đề nghị');
  expect(errors).toEqual([]);
});

test('reception uses only its queue/detail APIs and sends eligible=false correctly', async ({ page }) => {
  const item = { refundId: 'refund-1', memberId: member.accountId, memberName: member.fullName, memberCode: member.memberId, courseName: run.courseName, runCode: run.runCode, courseRunStatus: 'IN_PROGRESS', amount: 700000, source: 'MEMBER_WITHDRAWAL', approvedAt: yesterday, disbursementEligible: false, disbursementEligibilityReason: 'AWAITING_COURSE_COMPLETION' };
  const { calls, errors } = await mockApi(page, 'RECEPTIONIST', ({ path }) => {
    if (path === '/reception/course-refunds') return { body: pageOf([item]) };
    if (path === '/reception/course-refunds/refund-1') return { body: item };
  });
  await page.goto('/reception/course-refunds');
  await expect(page.getByRole('cell').filter({ hasText: member.fullName })).toContainText(member.memberId);
  await page.getByLabel('Điều kiện chi').selectOption('false');
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Chờ đợt học hoàn thành');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: test.info().outputPath('reception-refund-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(calls.some((call) => call.path === '/reception/course-refunds' && call.url.searchParams.get('eligible') === 'false')).toBe(true);
  expect(calls.some((call) => call.path.startsWith('/manager/'))).toBe(false);
  expect(calls.some((call) => call.path.endsWith('/disburse'))).toBe(false);
  expect(errors).toEqual([]);
});

test('member responds to schedule change while expired requests have no response buttons', async ({ page }) => {
  const changes = [{ id: 'change-1', enrollmentSessionId: 'enrollment-session-1', oldStartAt: nextMonth, oldEndAt: nextMonth, newStartAt: nextMonth, newEndAt: nextMonth, status: 'PENDING', responseDeadline: nextMonth }, { id: 'expired-change', status: 'PENDING', responseDeadline: yesterday }];
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, body }) => {
    if (path === '/members/me/course-schedule-changes') return { body: changes };
    if (path === '/members/me/course-schedule-changes/change-1/response') {
      expect(body).toEqual({ response: 'REQUEST_TRANSFER' });
      return { body: { ...changes[0], status: 'RESPONDED', response: 'REQUEST_TRANSFER', respondedAt: new Date().toISOString() } };
    }
  });
  await page.goto('/member/courses/schedule-changes');
  await expect(page.getByRole('button', { name: 'Đề nghị chuyển đợt học', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Đề nghị chuyển đợt học', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi phản hồi' }).click();
  await expect(page.getByText('Đã gửi yêu cầu chuyển đợt học cho quản lý.')).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith('/response'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('member acceptance retries with a stable key and continues the difference order', async ({ page }) => {
  const offer = { id: 'offer-1', sourceEnrollmentId: enrollment.enrollmentId, sourceRunId: run.id, targetRunId: 'target-1', status: 'OFFERED', expiresAt: nextMonth, creditVnd: 700000, targetTuitionVnd: 900000, differenceVnd: 200000 };
  let attempts = 0;
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, method }) => {
    if (path === '/members/me/course-transfer-offers') return { body: [offer] };
    if (path === '/course-runs/target-1') return { body: { ...run, id: 'target-1', runCode: 'YOGA-02', sessions: [] } };
    if (path === '/members/me/course-transfer-offers/offer-1/accept' && method === 'POST') {
      attempts++;
      return attempts === 1 ? { status: 503, body: {} } : { body: { ...offer, status: 'PENDING_PAYMENT', differenceOrderId: 'order-1' } };
    }
    if (path === '/members/me/course-orders/order-1') return { body: { orderId: 'order-1', orderStatus: 'PENDING_PAYMENT', tuitionVnd: 200000, currencyCode: 'VND', expiresAt: nextMonth } };
  });
  await page.goto('/member/courses/transfers');
  await page.getByRole('button', { name: 'Xem đợt thay thế và chấp nhận' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('YOGA-02');
  await dialog.getByRole('button', { name: 'Chấp nhận đề nghị', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Chưa xác nhận được kết quả');
  await dialog.getByRole('button', { name: 'Chấp nhận đề nghị', exact: true }).click();
  await expect(page).toHaveURL(/target-1\/register\?orderId=order-1/);
  const accepts = calls.filter((call) => call.path.endsWith('/accept'));
  expect(accepts).toHaveLength(2);
  expect(accepts[0].headers['idempotency-key']).toBeTruthy();
  expect(accepts[1].headers['idempotency-key']).toBe(accepts[0].headers['idempotency-key']);
  expect(errors).toEqual([]);
});

test('course-only room impact cannot be applied as an empty gym impact', async ({ page }) => {
  const { calls, errors } = await mockApi(page, 'MANAGER', ({ path }) => {
    if (path === '/manager/rooms/room-1') return { body: { id: 'room-1', name: 'Yoga A', capacity: 20, status: 'ACTIVE' } };
    if (path.endsWith('/impact-preview')) return { body: { count: 1, sessions: [], bulkAvailableTargetRooms: [], courseSessionIds: ['session-1'] } };
  });
  await page.goto('/manager/rooms/room-1/impact');
  await page.locator('select[name="mode"]').selectOption('PERMANENT');
  await page.locator('textarea[name="reason"]').fill('Bảo trì phòng');
  await page.getByRole('button', { name: 'Xem trước ảnh hưởng' }).click();
  await expect(page.getByText('Có 1 buổi khóa học dùng phòng này.', { exact: false })).toBeVisible();
  await expect(page.getByText('Không có buổi tập cần xử lý. Bạn có thể áp dụng ngay.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kiểm tra lại và áp dụng' })).toBeDisabled();
  expect(calls.some((call) => call.path.endsWith('/impact-apply'))).toBe(false);
  expect(errors).toEqual([]);
});

test('member order creation keeps its retry key after an uncertain failure', async ({ page }) => {
  let attempts = 0;
  const order = { orderId: 'order-1', courseRunId: run.id, orderReference: 'COR-TEST', orderStatus: 'PENDING_PAYMENT', tuitionVnd: 900000, expiresAt: nextMonth };
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, method }) => {
    if (path === '/course-runs/run-1') return { body: { ...run, registrationStatus: 'OPEN', tuitionVnd: 900000, sessions: [] } };
    if (path === '/members/me/course-orders/order-1') return { body: order };
    if (path === '/members/me/course-orders' && method === 'POST') {
      attempts++;
      return attempts === 1 ? { status: 503, body: {} } : { body: order };
    }
  });
  await page.goto('/member/courses/run-1/register');
  await page.getByRole('button', { name: 'Tạo đơn đăng ký', exact: true }).click();
  await expect(page.getByText('Không thể tạo đơn đăng ký khóa học.')).toBeVisible();
  await page.getByRole('button', { name: 'Tạo đơn đăng ký', exact: true }).click();
  await expect(page).toHaveURL(/orderId=order-1/);
  const creates = calls.filter((call) => call.path === '/members/me/course-orders' && call.method === 'POST');
  expect(creates).toHaveLength(2);
  expect(creates[0].headers['idempotency-key']).toBeTruthy();
  expect(creates[0].headers['idempotency-key']).toBe(creates[1].headers['idempotency-key']);
  expect(errors).toEqual([]);
});

test('manager cannot decide when refund detail fails to load', async ({ page }) => {
  const { calls, errors } = await mockApi(page, 'MANAGER', ({ path }) => {
    if (path === '/manager/course-refund-obligations') return { body: pageOf([refund]) };
    if (path === '/manager/course-refund-obligations/refund-1') return { status: 503, body: {} };
  });
  await page.goto('/manager/course-refunds?id=refund-1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Không tải được đầy đủ hồ sơ và đợt học');
  await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0);
  expect(calls.some((call) => call.path.endsWith('/approve'))).toBe(false);
  expect(calls.some((call) => call.path === '/manager/members/member-1')).toBe(false);
  expect(errors).toEqual([]);
});

test('Course reconciliation keeps the exact decision and key after an uncertain response', async ({ page }) => {
  const payment = { paymentId: 'course-pay-qa', orderId: 'course-order-qa', orderReference: 'COR-QA', memberName: 'Hội viên QA', memberCode: 'MB-QA', paymentReference: 'COR-QA', amount: 1000, status: 'PENDING', deadlineAt: nextMonth };
  let posts = 0;
  const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method }) => {
    if (path === '/course-payments/reconciliation-queue') return { body: { content: posts > 1 ? [] : [payment], page: 0, totalPages: 1 } };
    if (path === '/course-payments/course-pay-qa') return { body: { payment, bankCode: 'QA', bankAccountNumber: '123', bankAccountName: 'QA ACCOUNT', transferContent: 'COR-QA', canConfirmPaid: true, canConfirmFailed: false } };
    if (path === '/course-payments/course-pay-qa/reconcile' && method === 'POST') {
      posts++;
      return posts === 1 ? { status: 503, body: { code: 'UNAVAILABLE' } } : { body: { ...payment, status: 'PAID', enrollment: { enrollmentId: 'qa-enrollment' } } };
    }
  });
  await page.goto('/manager/course-payments/reconcile');
  await page.getByRole('button', { name: 'Đối soát', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Số tiền thực nhận (VND)').fill('1000');
  await dialog.getByLabel('Nội dung chuyển khoản thực tế').fill('COR-QA');
  await dialog.getByLabel('Mã giao dịch ngân hàng').fill('QA-TX');
  await dialog.getByLabel('Chứng từ đối soát').fill('QA receipt');
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('QA matched');
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await expect(dialog.getByText('Không xác nhận được kết quả.', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Số tiền thực nhận (VND)')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Thử lại quyết định đã gửi' }).click();
  await expect(dialog).toContainText('Hệ thống đã ghi nhận đăng ký khóa học.');
  const writes = calls.filter(c => c.method === 'POST' && c.path.endsWith('/reconcile'));
  expect(writes).toHaveLength(2);
  expect(writes[0].headers['idempotency-key']).toBeTruthy();
  expect(writes[1].headers['idempotency-key']).toBe(writes[0].headers['idempotency-key']);
  expect(writes[1].body).toEqual(writes[0].body);
  expect(calls.some(c => c.path.startsWith('/payments/'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Course reconciliation Reception cannot confirm paid after the backend blocks expiry', async ({ page }) => {
  const payment = { paymentId: 'expired-qa', orderReference: 'COR-EXPIRED', memberName: 'Hội viên QA', memberCode: 'MB-QA', amount: 1000, deadlineAt: yesterday };
  const { calls, errors } = await mockApi(page, 'RECEPTIONIST', ({ path, method, body }) => {
    if (path === '/course-payments/reconciliation-queue') return { body: { content: [payment], page: 0, totalPages: 1 } };
    if (path === '/course-payments/expired-qa') return { body: { payment, canConfirmPaid: false, canConfirmFailed: true, blockedReason: 'PAYMENT_WINDOW_EXPIRED' } };
    if (path === '/course-payments/expired-qa/reconcile' && method === 'POST') {
      expect(body).toEqual({ status: 'FAILED', evidence: 'QA expired receipt', reason: 'QA expired hold' });
      return { body: { ...payment, status: 'FAILED' } };
    }
  });
  await page.goto('/reception/course-payments/reconcile');
  await page.getByRole('button', { name: 'Đối soát', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Đã hết hạn thanh toán');
  await expect(dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true })).toBeDisabled();
  await dialog.getByLabel('Kết quả đối soát').selectOption('FAILED');
  await dialog.getByLabel('Chứng từ đối soát').fill('QA expired receipt');
  await dialog.getByLabel('Lý do / kết quả đối chiếu').fill('QA expired hold');
  await dialog.getByRole('button', { name: 'Xác nhận đối soát', exact: true }).click();
  await expect(dialog).toContainText('Đã ghi nhận thất bại');
  expect(calls.filter(c => c.method === 'POST' && c.path.endsWith('/reconcile'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('QA cash succeeds but refresh fails: successful mutation must not remain submittable', async ({ page }) => {
  let paid = false; let allowRefresh = false;
  const order = { orderId: 'order-1', courseRunId: run.id, orderReference: 'COR-QA', orderStatus: 'PENDING_PAYMENT', tuitionVnd: 1000, expiresAt: nextMonth, payment: null };
  const { calls } = await mockApi(page, 'RECEPTIONIST', ({ path, method }) => {
    if (path === '/reception/members/search') return { body: { ...member, status: 'ACTIVE' } };
    if (path === '/course-runs/run-1') return { body: { ...run, status: 'OPEN_FOR_REGISTRATION', sessions: [] } };
    if (path === '/reception/members/member-1/course-orders/order-1') return paid && !allowRefresh ? { status: 503, body: { code: 'UNAVAILABLE' } } : { body: paid ? { ...order, orderStatus: 'PAID', payment: { status: 'PAID', method: 'CASH' } } : order };
    if (path.endsWith('/payments/cash') && method === 'POST') { paid = true; return { body: { enrollmentId: 'enrollment-1', orderId: 'order-1', memberId: 'member-1', courseRunId: 'run-1', amountPaidVnd: 1000, totalUnits: 1, enrolledAt: yesterday } }; }
    if (path === '/reception/members/member-1/course-enrollments') return { body: { content: [], page: 0, totalPages: 0 } };
    if (path === '/reception/members/member-1/course-refund-obligations') return { body: pageOf([]) };
    if (path.startsWith('/reception/members/member-1/')) return { body: [] };
  });
  await page.goto('/reception/courses?orderId=order-1&memberCode=MB-001');
  await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Đã ghi nhận thanh toán, chưa tải lại được dữ liệu.', { exact: false })).toBeVisible();
  expect(calls.filter(c => c.path.endsWith('/payments/cash'))).toHaveLength(1);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true })).toHaveCount(0);
  allowRefresh = true;
  await page.getByRole('button', { name: 'Cập nhật thanh toán', exact: true }).click();
  await expect(page.getByText('Đã ghi nhận thanh toán, chưa tải lại được dữ liệu.', { exact: false })).toHaveCount(0);
  expect(calls.filter(c => c.path.endsWith('/payments/cash'))).toHaveLength(1);
});

test('cash uncertain response retries the same key without claiming success', async ({ page }) => {
  let paid = false; let allowRefresh = true; let attempts = 0;
  const order = { orderId: 'order-1', courseRunId: run.id, orderReference: 'COR-QA', orderStatus: 'PENDING_PAYMENT', tuitionVnd: 1000, expiresAt: nextMonth, payment: null };
  const { calls } = await mockApi(page, 'RECEPTIONIST', ({ path, method }) => {
    if (path === '/reception/members/search') return { body: { ...member, status: 'ACTIVE' } };
    if (path === '/course-runs/run-1') return { body: { ...run, status: 'OPEN_FOR_REGISTRATION', sessions: [] } };
    if (path === '/reception/members/member-1/course-orders/order-1') return paid && !allowRefresh ? { status: 503, body: { code: 'UNAVAILABLE' } } : { body: paid ? { ...order, orderStatus: 'PAID', payment: { status: 'PAID', method: 'CASH' } } : order };
    if (path.endsWith('/payments/cash') && method === 'POST') { attempts++; if (attempts === 1) return { status: 503, body: {} }; paid = true; return { body: { enrollmentId: 'enrollment-1', orderId: 'order-1', memberId: 'member-1', courseRunId: 'run-1', amountPaidVnd: 1000, totalUnits: 1, enrolledAt: yesterday } }; }
    if (path === '/reception/members/member-1/course-enrollments') return { body: { content: [], page: 0, totalPages: 0 } };
    if (path === '/reception/members/member-1/course-refund-obligations') return { body: pageOf([]) };
    if (path.startsWith('/reception/members/member-1/')) return { body: [] };
  });
  await page.goto('/reception/courses?orderId=order-1&memberCode=MB-001');
  await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Chưa xác nhận được kết quả thu tiền');
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const posts = calls.filter(c => c.path.endsWith('/payments/cash'));
  expect(posts).toHaveLength(2);
  expect(posts[0].headers['idempotency-key']).toBeTruthy();
  expect(posts[1].headers['idempotency-key']).toBe(posts[0].headers['idempotency-key']);
  expect(posts[1].body).toEqual(posts[0].body);
});


test('course history separates terminal enrollments and keeps pending withdrawals accessible', async ({ page }) => {
  const variants = [
    ['current', 'ACTIVE', 'IN_PROGRESS'],
    ['pending', 'WITHDRAWAL_PENDING', 'COMPLETED'],
    ['completed', 'COMPLETED', 'COMPLETED'],
    ['withdrawn', 'WITHDRAWN', 'IN_PROGRESS'],
    ['transferred', 'TRANSFERRED', 'IN_PROGRESS'],
    ['cancelled', 'ACTIVE', 'CANCELLED'],
    ['ended-run', 'ACTIVE', 'COMPLETED'],
  ].map(([id, lifecycleStatus, courseRunStatus]) => ({ ...enrollment, enrollmentId: id, courseName: `Khóa ${id}`, lifecycleStatus, courseRunStatus }));
  const { errors } = await mockApi(page, 'MEMBER', ({ path }) => path === '/members/me/course-enrollments' ? { body: variants } : undefined);
  await page.goto('/member/courses');
  await expect(page.locator('main article')).toHaveCount(2);
  await expect(page.locator('main')).toContainText('Khóa current');
  await expect(page.locator('main')).toContainText('Khóa pending');
  await page.getByRole('navigation', { name: 'Danh sách khóa học' }).getByRole('link', { name: 'Lịch sử khóa học' }).click();
  await expect(page.locator('main article')).toHaveCount(5);
  await expect(page.locator('main')).not.toContainText('Khóa current');
  await expect(page.locator('main')).not.toContainText('Khóa pending');
  await expect(page.locator('main article').filter({ hasText: 'Khóa cancelled' })).toContainText('Đã hủy');
  await page.locator('main article').filter({ hasText: 'Khóa completed' }).getByRole('link', { name: 'Xem chi tiết' }).click();
  await page.reload();
  await expect(page.locator('main')).toContainText('Buổi 1');
  await page.getByRole('link', { name: '← Lịch sử khóa học', exact: true }).click();
  await expect(page).toHaveURL(/\/member\/courses\/history$/);
  await expect(page.locator('main article')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('split course pages load only their workflow and preserve details, filters and old links', async ({ page }) => {
  const { calls, errors } = await mockApi(page, 'MEMBER', () => undefined);
  await page.goto('/member/courses');
  await expect(page.getByRole('link', { name: 'Xem chi tiết', exact: true })).toBeVisible();
  await expect(page.locator('.member-course-session-stack')).toHaveCount(0);
  expect(calls.some(c => /course-(waitlists|withdrawal-requests|refund-obligations|schedule-changes|transfer-offers)$/.test(c.path))).toBe(false);
  await page.getByRole('link', { name: 'Xem chi tiết', exact: true }).click();
  await expect(page).toHaveURL(/courses\/enrollments\/enrollment-1/);
  await expect(page.locator('main')).toContainText('Buổi 1');
  await page.reload();
  await expect(page.locator('main')).toContainText('Buổi 1');
  await page.getByRole('navigation', { name: 'Yêu cầu của khóa học' }).getByRole('link', { name: 'Rút khóa học' }).click();
  await expect(page.locator('#course-withdrawal-enrollment')).toHaveValue('enrollment-1');
  for (const [hash, heading] of [['refunds','Hoàn tiền khóa học'], ['withdrawals','Rút khóa học'], ['transfers','Chuyển đợt học'], ['schedule-changes','Thay đổi lịch học']]) {
    await page.goto('/member/courses#' + hash);
    await expect(page).toHaveURL(new RegExp('/member/courses/' + hash + '$'));
    await expect(page.getByRole('heading', { name: 'Yêu cầu khóa học', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Loại yêu cầu khóa học' }).getByRole('link', { name: heading, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.goto('/member/courses/enrollments/not-owned');
  await expect(page.locator('main')).toContainText('Không tìm thấy khóa học');
  await page.goto('/member/courses/waitlist');
  await expect(page.getByRole('heading', { name: 'Danh sách chờ khóa học', level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('split withdrawal page submits the selected enrollment and shows persisted request', async ({ page }) => {
  let requests = [];
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, method, body }) => {
    if (path === '/members/me/course-withdrawal-requests' && method === 'GET') return { body: requests };
    if (path === '/members/me/course-enrollments/enrollment-1/withdrawal-requests' && method === 'POST') {
      requests = [{ id: 'withdraw-split', enrollmentId: enrollment.enrollmentId, status: 'PENDING', requestReason: body.reason, requestedAt: yesterday }];
      return { body: requests[0] };
    }
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/member/courses/withdrawals?enrollmentId=enrollment-1');
  await expect(page.locator('#course-withdrawal-enrollment')).toHaveValue('enrollment-1');
  await page.getByLabel('Lý do xin rút').fill('Thay đổi lịch làm việc');
  await page.getByRole('button', { name: 'Gửi yêu cầu rút', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('main')).toContainText('Thay đổi lịch làm việc');
  expect(calls.filter(c => c.method === 'POST' && c.path.endsWith('/withdrawal-requests'))).toHaveLength(1);
  expect(errors).toEqual([]);
});


test('split waitlist page leaves a queue and accepts an invitation into checkout', async ({ page }) => {
  let items = [
    { id: 'waiting-1', courseRunId: 'run-2', status: 'WAITING', position: 2, courseName: 'Khóa đang chờ' },
    { id: 'invite-1', courseRunId: run.id, status: 'INVITED', invitationExpiresAt: nextMonth, courseName: 'Khóa được mời' },
  ];
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, method }) => {
    if (path === '/members/me/course-waitlists') return { body: items };
    if (path === '/course-runs/run-2/waitlist' && method === 'DELETE') { items = items.filter(i => i.id !== 'waiting-1'); return { body: {} }; }
    if (path === '/course-waitlists/invite-1/accept') return { body: { orderId: 'invitation-order' } };
    if (path === '/course-runs/run-1') return { body: run };
    if (path === '/members/me/course-orders/invitation-order') return { body: { orderId: 'invitation-order', orderStatus: 'PENDING_PAYMENT', tuitionVnd: 100000, expiresAt: nextMonth } };
  });
  await page.goto('/member/courses/waitlist');
  await expect(page.getByText('#2')).toBeVisible();
  expect(calls.some(c => c.path === '/members/me/course-enrollments')).toBe(false);
  await page.getByRole('article').filter({ hasText: 'Khóa đang chờ' }).getByRole('button', { name: 'Rời danh sách chờ' }).click();
  await expect(page.getByRole('article').filter({ hasText: 'Khóa đang chờ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhận chỗ và thanh toán', exact: true }).click();
  await expect(page).toHaveURL(/run-1\/register\?orderId=invitation-order/);
  expect(calls.filter(c => c.path.endsWith('/accept'))[0].headers['idempotency-key']).toBeTruthy();
  expect(errors).toEqual([]);
});

test('split selected-course filters hide requests belonging to another enrollment', async ({ page }) => {
  const second = { ...enrollment, enrollmentId: 'enrollment-2', courseName: 'Khóa khác', courseRunId: 'run-2', sessions: [] };
  await mockApi(page, 'MEMBER', ({ path }) => {
    if (path === '/members/me/course-enrollments') return { body: [enrollment, second] };
    if (path === '/members/me/course-withdrawal-requests') return { body: [
      { id: 'r1', enrollmentId: enrollment.enrollmentId, status: 'REJECTED', requestReason: 'Lý do đúng khóa' },
      { id: 'r2', enrollmentId: second.enrollmentId, status: 'REJECTED', requestReason: 'Lý do khác khóa' },
    ] };
    if (path === '/members/me/course-refund-obligations') return { body: pageOf([{ ...refund, id: 'own-refund' }, { ...refund, id: 'other-refund', enrollmentId: second.enrollmentId }]) };
  });
  await page.goto('/member/courses/withdrawals?enrollmentId=enrollment-1');
  await expect(page.locator('main')).toContainText('Lý do đúng khóa');
  await expect(page.locator('main')).not.toContainText('Lý do khác khóa');
  await page.goto('/member/courses/refunds?enrollmentId=enrollment-1');
  await expect(page.locator('main article')).toHaveCount(1);
  await page.getByLabel('Khóa học', { exact: true }).selectOption('');
  await expect(page.locator('main article')).toHaveCount(2);
});
