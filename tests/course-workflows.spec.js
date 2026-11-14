import { test, expect } from '@playwright/test';

const run = { id: 'run-1', courseName: 'Yoga nền tảng', courseCode: 'YOGA', runCode: 'YOGA-01', status: 'COMPLETED', primaryCoachName: 'Huấn luyện viên An' };
const member = { accountId: 'member-1', memberId: 'MB-001', fullName: 'Nguyễn Minh An', role: 'MEMBER' };
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const enrollment = { enrollmentId: 'enrollment-1', courseRunId: run.id, courseName: run.courseName, courseCode: run.courseCode, runCode: run.runCode, lifecycleStatus: 'ACTIVE', enrolledAt: yesterday, sessions: [{ enrollmentSessionId: 'enrollment-session-1', courseSessionId: 'session-1', unitNumber: 1, startAt: nextMonth, endAt: nextMonth, disposition: 'ENROLLED', attendanceStatus: 'NOT_RECORDED' }] };
const refund = { memberName: member.fullName, memberCode: member.memberId, courseName: run.courseName, runCode: run.runCode, id: 'refund-1', memberAccountId: member.accountId, courseRunId: run.id, enrollmentId: enrollment.enrollmentId, source: 'MEMBER_WITHDRAWAL', status: 'PENDING_REVIEW', grossObligationVnd: 700000, approvedAmountVnd: null, disbursedAmountVnd: null, verifiedAmountVnd: null, version: 3, createdAt: yesterday, requestReason: 'Đổi lịch làm việc' };
const pageOf = (items) => ({ items, page: 0, size: 20, totalElements: items.length, totalPages: items.length ? 1 : 0 });

for (const mode of ['batch', 'retry', 'single']) {
  test(`manager saves selected session schedules in one request: ${mode}`, async ({ page }) => {
    let currentRun = { ...run, status: 'OPEN_FOR_REGISTRATION', capacity: 10, minimumEnrollment: 1, totalUnits: 4, tuitionVnd: 1000000, version: 7, plannedStartAt: '2099-02-02T12:00:00Z', plannedEndAt: '2099-02-23T13:00:00Z' };
    let sessions = ['02', '09', '16', '23'].map((day, i) => ({ id: `session-${i + 1}`, unitNumber: i + 1, roomId: 'room-1', coachId: 'coach-1', roomName: 'Phòng A', coachName: 'HLV An', startAt: `2099-02-${day}T12:00:00Z`, endAt: `2099-02-${day}T13:00:00Z`, status: 'SCHEDULED', version: 3 }));
    let attempts = 0;
    const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
      if (path === '/manager/course-runs/run-1') return { body: currentRun };
      if (path === '/manager/course-runs/run-1/sessions') return { body: sessions };
      if (path === '/manager/course-runs/resource-availability') return { body: { rooms: [{ id: 'room-1', name: 'Phòng A' }], coaches: [{ accountId: 'coach-1', fullName: 'HLV An' }] } };
      if (path === '/manager/course-runs/run-1/reschedule' && method === 'POST') {
        attempts++;
        if (mode === 'retry' && attempts === 1) return { status: 503, body: { message: 'Thử lại' } };
        sessions = sessions.map(session => {
          const change = body.sessions.find(item => item.sessionId === session.id);
          return change ? { ...session, startAt: change.startAt, endAt: change.endAt, version: 4 } : session;
        });
        currentRun = { ...currentRun, plannedStartAt: body.plannedStartAt, plannedEndAt: body.plannedEndAt, version: 8 };
        return { body: { run: currentRun, sessions, changeEventId: 'one-event' } };
      }
    });
    await page.goto('/manager/course-runs/run-1');
    await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toHaveCount(4);
    await page.getByRole('button', { name: 'Dời nhiều buổi', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Lưu tất cả' })).toBeDisabled();
    await dialog.getByLabel('Buổi 1', { exact: true }).check();
    await expect(dialog.getByRole('button', { name: 'Lưu tất cả' })).toBeEnabled();
    if (mode === 'batch') {
      await dialog.getByRole('button', { name: 'Lưu tất cả' }).click();
      await expect(dialog).toContainText('Chọn buổi và thay đổi ngày hoặc khung giờ');
      expect(calls.filter(call => call.method === 'POST' && call.path.endsWith('/reschedule'))).toHaveLength(0);
    }
    await dialog.getByLabel('Buổi 1 - slot', { exact: true }).selectOption('8');
    if (mode !== 'single') {
      await dialog.getByLabel('Buổi 4', { exact: true }).check();
      await dialog.getByLabel('Buổi 4 - ngày', { exact: true }).fill('02/03/2099');
      await dialog.getByLabel('Buổi 4 - slot', { exact: true }).selectOption('8');
      // Unchecked edits must not reach the API.
      await dialog.getByLabel('Buổi 2', { exact: true }).check();
      await dialog.getByLabel('Buổi 2 - slot', { exact: true }).selectOption('8');
      await dialog.getByLabel('Buổi 2', { exact: true }).uncheck();
    }
    if (mode === 'batch') {
      await page.screenshot({ path: test.info().outputPath('batch-reschedule-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog.getByRole('button', { name: 'Lưu tất cả' })).toBeInViewport();
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath('batch-reschedule-mobile.png') });
    }
    await dialog.getByRole('button', { name: 'Lưu tất cả' }).click();
    if (mode === 'retry') {
      await expect(dialog).toContainText('Chưa xác định kết quả');
      await expect(dialog.getByLabel('Buổi 1', { exact: true })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
    }
    await expect(dialog).toHaveCount(0);
    const posts = calls.filter(call => call.method === 'POST' && call.path.endsWith('/reschedule'));
    expect(posts).toHaveLength(mode === 'retry' ? 2 : 1);
    expect(posts[0].body).toEqual({
      expectedVersion: 7, totalUnits: 4,
      plannedStartAt: '2099-02-02T14:00:00.000Z',
      plannedEndAt: mode === 'single' ? '2099-02-23T13:00:00.000Z' : '2099-03-02T15:00:00.000Z',
      sessions: [
        { sessionId: 'session-1', expectedVersion: 3, startAt: '2099-02-02T14:00:00.000Z', endAt: '2099-02-02T15:00:00.000Z', roomId: 'room-1', coachId: 'coach-1' },
        ...(mode === 'single' ? [] : [{ sessionId: 'session-4', expectedVersion: 3, startAt: '2099-03-02T14:00:00.000Z', endAt: '2099-03-02T15:00:00.000Z', roomId: 'room-1', coachId: 'coach-1' }]),
      ],
    });
    if (mode === 'retry') {
      expect(posts[1].body).toEqual(posts[0].body);
      expect(posts[1].headers['idempotency-key']).toBe(posts[0].headers['idempotency-key']);
    }
    expect(errors).toEqual([]);
  });
}

for (const failure of [false, true]) {
  test(`batch reschedule replaces unavailable resources and blocks internal conflicts: retry=${failure}`, async ({ page }) => {
    const currentRun = { ...run, status: 'OPEN_FOR_REGISTRATION', capacity: 10, totalUnits: 2, version: 1, plannedStartAt: '2099-02-02T12:00:00Z', plannedEndAt: '2099-02-09T13:00:00Z' };
    const sessions = ['02', '09'].map((day, i) => ({ id: `session-${i + 1}`, unitNumber: i + 1, roomId: 'r1', coachId: 'c1', roomName: 'Phòng cũ', coachName: 'HLV cũ', startAt: `2099-02-${day}T12:00:00Z`, endAt: `2099-02-${day}T13:00:00Z`, status: 'SCHEDULED', version: 1 }));
    let shouldFail = failure;
    const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
      if (path === '/manager/course-runs/run-1') return { body: currentRun };
      if (path === '/manager/course-runs/run-1/sessions') return { body: sessions };
      if (path.endsWith('/resource-availability')) {
        const changed = body.windows[0].startAt.includes('T14:');
        if (changed && shouldFail) { shouldFail = false; return { status: 503, body: {} }; }
        return { body: { rooms: [{ id: changed ? 'r2' : 'r1', name: changed ? 'Phòng mới' : 'Phòng cũ' }], coaches: [{ accountId: changed ? 'c2' : 'c1', fullName: changed ? 'HLV mới' : 'HLV cũ' }] } };
      }
      if (path.endsWith('/reschedule') && method === 'POST') return { body: { run: { ...currentRun, version: 2 }, sessions } };
    });
    await page.goto('/manager/course-runs/run-1');
    await page.getByRole('button', { name: 'Dời nhiều buổi', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const save = dialog.getByRole('button', { name: 'Lưu tất cả' });
    await dialog.getByLabel('Buổi 1', { exact: true }).check();
    await expect(dialog.getByLabel('Buổi 1 - phòng', { exact: true })).toHaveValue('r1');
    await dialog.getByLabel('Buổi 1 - slot', { exact: true }).selectOption('8');
    await expect(save).toBeDisabled();
    if (failure) {
      await expect(dialog).toContainText('Không tải được phòng và HLV trống');
      await dialog.getByRole('button', { name: 'Tải lại', exact: true }).click();
    }
    await expect(dialog.getByLabel('Buổi 1 - phòng', { exact: true })).toHaveValue('');
    await expect(dialog.getByLabel('Buổi 1 - HLV', { exact: true })).toHaveValue('');
    await expect(dialog.getByLabel('Buổi 1 - phòng', { exact: true })).toBeEnabled();
    await expect(dialog.locator('.is-invalid')).toHaveCount(0);
    await expect(dialog.getByText('Chọn phòng còn trống.', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Chọn HLV còn trống.', { exact: true })).toHaveCount(0);
    await dialog.getByLabel('Buổi 1 - phòng', { exact: true }).focus();
    await dialog.getByLabel('Buổi 1 - phòng', { exact: true }).press('Tab');
    await expect(dialog.getByLabel('Buổi 1 - phòng', { exact: true })).toHaveClass(/is-invalid/);
    await expect(dialog.getByLabel('Buổi 1 - phòng').locator('option[value="r1"]')).toHaveCount(0);
    await dialog.getByLabel('Buổi 1 - phòng', { exact: true }).selectOption('r2');
    await dialog.getByLabel('Buổi 1 - HLV', { exact: true }).selectOption('c2');
    await expect(dialog.getByLabel('Buổi 1 - phòng', { exact: true })).not.toHaveClass(/is-invalid/);
    await expect(dialog.getByLabel('Buổi 1 - HLV', { exact: true })).not.toHaveClass(/is-invalid/);
    await dialog.getByLabel('Buổi 2', { exact: true }).check();
    await dialog.getByLabel('Buổi 2 - ngày', { exact: true }).fill('02/02/2099');
    await dialog.getByLabel('Buổi 2 - slot', { exact: true }).selectOption('8');
    await expect(dialog.getByLabel('Buổi 2 - phòng')).toContainText('Không có phòng trống');
    await expect(dialog.getByLabel('Buổi 2 - HLV')).toContainText('Không có HLV trống');
    await expect(save).toBeDisabled();
    expect(calls.filter(call => call.path.endsWith('/reschedule'))).toHaveLength(0);
    await dialog.getByLabel('Buổi 2 - slot', { exact: true }).selectOption('7');
    await expect(dialog.getByLabel('Buổi 2 - phòng').locator('option[value="r1"]')).toHaveCount(1);
    await dialog.getByLabel('Buổi 2 - phòng').selectOption('r1');
    await dialog.getByLabel('Buổi 2 - HLV').selectOption('c1');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toHaveCount(0);
    const posts = calls.filter(call => call.method === 'POST' && call.path.endsWith('/reschedule'));
    expect(posts).toHaveLength(1);
    expect(posts[0].body.sessions).toEqual([
      expect.objectContaining({ sessionId: 'session-1', roomId: 'r2', coachId: 'c2' }),
      expect.objectContaining({ sessionId: 'session-2', roomId: 'r1', coachId: 'c1' }),
    ]);
    expect(calls.filter(call => call.path.endsWith('/resource-availability')).at(-1).body.excludeSessionIds).toEqual(['session-1', 'session-2']);
    expect(errors).toEqual([]);
  });
}

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

test('retired transfer URLs redirect without requesting transfer APIs', async ({ page }) => {
  const { calls } = await mockApi(page, 'MEMBER', () => undefined);
  await page.goto('/member/courses/transfers');
  await expect(page).toHaveURL(/member\/courses\/schedule-changes$/);
  await expect(page.getByRole('link', { name: 'Chuyển đợt học', exact: true })).toHaveCount(0);
  expect(calls.some(call => call.path.includes('course-transfer'))).toBe(false);
});

test('manager request workspace has no transfer tab or API calls', async ({ page }) => {
  const { calls } = await mockApi(page, 'MANAGER', ({ path }) => {
    if (path === '/manager/course-withdrawal-requests') return { body: [] };
  });
  await page.goto('/manager/course-transfers');
  await expect(page).toHaveURL(/manager\/course-withdrawals$/);
  await expect(page.getByRole('link', { name: 'Chuyển đợt học', exact: true })).toHaveCount(0);
  expect(calls.some(call => call.path.includes('course-transfer'))).toBe(false);
});

test('reception searches refund members across pages and combines eligibility without changing payments', async ({ page }) => {
  const item = { refundId: 'refund-search', memberName: 'Loc Test One', memberCode: 'MB-100082', courseName: 'Aerobic', runCode: 'TEST-HUY-SAU-1-BUOI', amount: 900000, disbursementEligibilityReason: 'ELIGIBLE' };
  const { calls, errors } = await mockApi(page, 'RECEPTIONIST', ({ path, url }) => {
    if (path !== '/reception/course-refunds') return;
    const query = url.searchParams.get('query');
    if (query === 'khong-co') return { body: pageOf([]) };
    return { body: { ...pageOf([item]), totalPages: query ? 1 : 2, totalElements: query ? 1 : 21 } };
  });
  await page.goto('/reception/course-refunds');
  await page.getByRole('button', { name: 'Trang sau', exact: false }).click();
  await expect.poll(() => calls.filter(c => c.path === '/reception/course-refunds').at(-1)?.url.searchParams.get('page')).toBe('1');
  await page.getByLabel('Tên, mã hoặc số điện thoại hội viên').fill('  MB-100082  ');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect.poll(() => calls.filter(c => c.path === '/reception/course-refunds').at(-1)?.url.searchParams.get('query')).toBe('MB-100082');
  expect(calls.filter(c => c.path === '/reception/course-refunds').at(-1).url.searchParams.get('page')).toBe('0');
  await page.getByLabel('Điều kiện chi').selectOption('false');
  await expect.poll(() => calls.filter(c => c.path === '/reception/course-refunds').at(-1)?.url.searchParams.get('eligible')).toBe('false');
  expect(calls.filter(c => c.path === '/reception/course-refunds').at(-1).url.searchParams.get('query')).toBe('MB-100082');
  await page.getByLabel('Tên, mã hoặc số điện thoại hội viên').fill('0901234567');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect.poll(() => calls.filter(c => c.path === '/reception/course-refunds').at(-1)?.url.searchParams.get('query')).toBe('0901234567');
  await page.getByLabel('Tên, mã hoặc số điện thoại hội viên').fill('khong-co');
  await page.getByLabel('Tên, mã hoặc số điện thoại hội viên').press('Enter');
  await expect(page.getByText('Không có khoản hoàn phù hợp.')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Loc Test One/ })).toBeVisible();
  expect(calls.filter(c => c.path === '/reception/course-refunds').at(-1).url.searchParams.has('query')).toBe(false);
  expect(calls.some(c => c.method !== 'GET' && c.path !== '/auth/refresh')).toBe(false);
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

for (const [choice, label, notice] of [
  ['CONTINUE', 'Theo lịch mới', 'Đã xác nhận tiếp tục học theo lịch mới.'],
  ['REQUEST_WITHDRAWAL', 'Yêu cầu hủy do đổi lịch', 'Đã gửi yêu cầu hủy do đổi lịch, chờ quản lý duyệt.'],
]) {
  test(`member can only continue or cancel after a schedule change: ${choice}`, async ({ page }) => {
    const changes = [
      { id: 'change-1', enrollmentSessionId: 'enrollment-session-1', oldStartAt: nextMonth, oldEndAt: nextMonth, newStartAt: nextMonth, newEndAt: nextMonth, status: 'PENDING', responseDeadline: nextMonth, withdrawalEligible: true, refundAmountVnd: 400000 },
      { id: 'expired-change', status: 'PENDING', responseDeadline: yesterday, withdrawalEligible: true },
    ];
    const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, body }) => {
      if (path === '/members/me/course-schedule-changes') return { body: changes };
      if (path === '/members/me/course-schedule-changes/change-1/response') {
        expect(body).toEqual({ response: choice });
        changes[0] = { ...changes[0], status: 'RESPONDED', response: choice, respondedAt: new Date().toISOString() };
        return { body: changes[0] };
      }
    });
    await page.goto('/member/courses/schedule-changes');
    await expect(page.getByRole('button', { name: 'Theo lịch mới', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Yêu cầu hủy do đổi lịch', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /chuyển đợt/i })).toHaveCount(0);
    await page.getByRole('button', { name: label, exact: true }).click();
    const dialog = page.getByRole('dialog');
    if (choice === 'REQUEST_WITHDRAWAL') {
      await expect(dialog).toContainText('toàn bộ đợt học này');
      await expect(dialog).toContainText('Hoàn tiền dự kiến');
      await expect(dialog).toContainText('400.000');
      await expect(dialog).toContainText('quản lý để xét duyệt');
      await expect(dialog.getByRole('listitem')).toHaveCount(3);
    }
    await page.screenshot({ path: test.info().outputPath(`confirmation-${choice}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    const confirm = dialog.getByRole('button', { name: choice === 'REQUEST_WITHDRAWAL' ? 'Gửi yêu cầu hủy' : 'Xác nhận theo lịch mới', exact: true });
    await expect(confirm).toBeInViewport();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`confirmation-${choice}-mobile.png`) });
    await confirm.click();
    await expect(page.getByText(notice)).toBeVisible();
    expect(calls.filter(call => call.path.endsWith('/response'))).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

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
  await page.locator('main article').filter({ hasText: 'Khóa cancelled' }).getByRole('link', { name: 'Xem chi tiết' }).click();
  await expect(page.locator('.member-course-status')).toHaveText('Đã hủy');
  await expect(page.locator('main')).not.toContainText('Đang theo học');
  await page.getByRole('link', { name: '← Lịch sử khóa học', exact: true }).click();
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
  for (const [hash, heading] of [['refunds','Hoàn tiền khóa học'], ['withdrawals','Rút khóa học'], ['schedule-changes','Thay đổi lịch học']]) {
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

test('member withdrawal card localizes system reasons, shows estimated refund, and still cancels', async ({ page }) => {
  let current = { id: 'withdraw-design', enrollmentId: enrollment.enrollmentId, status: 'PENDING',
    requestReason: 'Withdrawal requested after a material schedule change', requestedAt: yesterday,
    refundAmountVnd: 800000, remainingUnits: 4, totalUnits: 4, canCancel: true, learningSuspended: true };
  const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, method, body }) => {
    if (path === '/members/me/course-enrollments') return { body: [{ ...enrollment, lifecycleStatus: current.status === 'PENDING' ? 'WITHDRAWAL_PENDING' : 'ACTIVE' }] };
    if (path === '/members/me/course-withdrawal-requests') return { body: [current] };
    if (path === '/members/me/course-withdrawal-requests/withdraw-design/cancel' && method === 'POST') {
      expect(body).toEqual({ reason: 'Đã sắp xếp được thời gian học' });
      current = { ...current, status: 'CANCELLED', canCancel: false, learningSuspended: false, cancelledAt: new Date().toISOString(), cancellationReason: body.reason };
      return { body: current };
    }
  });
  await page.goto('/member/courses/withdrawals?enrollmentId=enrollment-1');
  const card = page.locator('#withdrawals article');
  await expect(card).toContainText('Trung tâm thay đổi lịch học.');
  await expect(card).not.toContainText('Withdrawal requested');
  await expect(card).toContainText('Hoàn tiền dự kiến');
  await expect(card).toContainText('800.000');
  await expect(card).toContainText('4/4 buổi');
  await expect(card.locator('.system-badge')).toHaveText('Chờ duyệt rút');
  await page.screenshot({ path: test.info().outputPath('withdrawal-card-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('withdrawal-card-mobile.png'), fullPage: true });
  await card.getByRole('button', { name: 'Hủy yêu cầu rút', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Lý do hủy', { exact: true }).fill('Đã sắp xếp được thời gian học');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hủy yêu cầu', exact: true }).click();
  await expect(card.locator('.system-badge')).toHaveText('Đã hủy yêu cầu rút');
  await expect(card).toContainText('Đã sắp xếp được thời gian học');
  await expect(card.getByRole('button', { name: 'Hủy yêu cầu rút', exact: true })).toHaveCount(0);
  expect(calls.filter(call => call.path.endsWith('/cancel'))).toHaveLength(1);
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


test('withdrawal queue and detail show live refund progress and link the matching obligation', async ({ page }) => {
  let current = { id: 'withdraw-progress', enrollmentId: enrollment.enrollmentId, memberAccountId: member.accountId, memberName: member.fullName, memberCode: member.memberId, courseRunId: run.id, courseName: run.courseName, runCode: run.runCode, status: 'APPROVED', requestReason: 'Xin rút để kiểm tra tiến độ hoàn', requestedAt: yesterday, refundObligationId: refund.id, refundStatus: 'PENDING_REVIEW' };
  const { errors } = await mockApi(page, 'MANAGER', ({ path }) => {
    if (path === '/manager/course-withdrawal-requests') return { body: [current] };
    if (path === '/manager/course-withdrawal-requests/withdraw-progress') return { body: current };
    if (path === '/manager/course-refund-obligations') return { body: pageOf([{ ...refund, status: current.refundStatus }]) };
    if (path === '/manager/course-refund-obligations/refund-1') return { body: { ...refund, status: current.refundStatus } };
  });
  const cases = [
    ['PENDING_REVIEW', 'Đã duyệt rút — chờ duyệt hoàn tiền'],
    ['APPROVED', 'Đã duyệt hoàn tiền — chờ chi'],
    ['DISBURSEMENT_RECORDED', 'Đã chi hoàn tiền — chờ xác minh'],
    ['COMPLETED', 'Hoàn tiền thành công'],
  ];
  await page.goto('/manager/course-withdrawals');
  for (const [refundStatus, label] of cases) {
    current = { ...current, refundStatus };
    await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: current.requestReason });
    await expect(row.locator('.system-badge')).toHaveText(label);
    await row.getByRole('button', { name: 'Xem hồ sơ' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.system-badge')).toHaveText(label);
    await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: 'Xem khoản hoàn' })).toHaveAttribute('href', '/manager/course-refunds?id=refund-1');
    await page.reload();
    await expect(page.getByRole('dialog').locator('.system-badge')).toHaveText(label);
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
  }
  current = { ...current, refundStatus: null, refundObligationId: null };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: current.requestReason });
  await expect(row).toContainText('Đã duyệt rút — chưa xác định trạng thái hoàn tiền');
  await page.screenshot({ path: test.info().outputPath('withdrawal-refund-mobile-list.png'), fullPage: true, animations: 'disabled' });
  await row.getByRole('button', { name: 'Xem hồ sơ' }).click();
  await expect(page.getByRole('dialog').locator('.system-badge')).toHaveText('Đã duyệt rút — chưa xác định trạng thái hoàn tiền');
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Xem khoản hoàn' })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('withdrawal-refund-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

for (const role of ['MEMBER', 'RECEPTIONIST']) {
  test(`${role} withdrawal history refreshes refund status without changing the withdrawal decision`, async ({ page }) => {
    let refundStatus = 'DISBURSEMENT_RECORDED';
    const current = () => ({ id: 'withdraw-progress', enrollmentId: enrollment.enrollmentId, courseRunId: run.id, courseName: run.courseName, runCode: run.runCode, status: 'APPROVED', refundStatus, refundObligationId: refund.id, requestedAt: yesterday, requestReason: 'Tiến độ hoàn tiền riêng', refundAmountVnd: 700000 });
    const { errors } = await mockApi(page, role, ({ path }) => {
      if (path.endsWith('/course-withdrawal-requests')) return { body: [current()] };
      if (path === '/reception/members/search') return { body: { ...member, status: 'ACTIVE' } };
      if (path.startsWith('/reception/members/')) {
        if (path.endsWith('/course-enrollments')) return { body: { content: [], totalPages: 0, totalElements: 0 } };
        if (path.endsWith('/course-refund-obligations')) return { body: pageOf([]) };
        return { body: [] };
      }
    });
    const open = async () => {
      await page.goto(role === 'MEMBER' ? '/member/courses/withdrawals' : '/reception/courses');
      if (role === 'RECEPTIONIST') {
        await page.getByLabel('Mã hội viên hoặc số điện thoại').fill(member.memberId);
        await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
      }
    };
    for (const [state, label] of [['DISBURSEMENT_RECORDED', 'Đã chi hoàn tiền — chờ xác minh'], ['COMPLETED', 'Hoàn tiền thành công'], ['RETURNED', 'Khoản chi hoàn tiền đã bị trả lại']]) {
      refundStatus = state;
      await open();
      const card = page.locator('article').filter({ hasText: role === 'MEMBER' ? 'Tiến độ hoàn tiền riêng' : run.runCode });
      await expect(card.locator('.system-badge')).toHaveText(label);
      await expect(card.getByRole('button', { name: 'Hủy yêu cầu rút', exact: true })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

for (const [status, label, endpoint] of [
  ['SCHEDULED', 'Hủy và xếp bù', 'cancel-with-makeup'],
  ['CANCELLED_PENDING_MAKEUP', 'Xếp buổi bù', 'makeup'],
]) {
  test(`makeup suggests next weekly occurrence and saves beyond the old run end: ${status}`, async ({ page }) => {
    let currentRun = { ...run, status: 'OPEN_FOR_REGISTRATION', capacity: 10, minimumEnrollment: 1, totalUnits: 4, tuitionVnd: 1000000, version: 1, plannedStartAt: '2099-02-02T12:00:00Z', plannedEndAt: '2099-02-23T13:00:00Z' };
    let sessions = ['02', '09', '16', '23'].map((day, i) => ({ id: `session-${i + 1}`, runId: 'run-1', unitNumber: i + 1, roomId: 'room-1', roomName: 'Phòng A', coachId: 'coach-1', coachName: 'HLV An', startAt: `2099-02-${day}T12:00:00Z`, endAt: `2099-02-${day}T13:00:00Z`, status: i === 0 ? status : 'SCHEDULED', isMakeup: false, version: 1, allocationVnd: 250000 }));
    const { calls, errors } = await mockApi(page, 'MANAGER', ({ path, method, body }) => {
      if (path === '/manager/course-runs/run-1') return { body: currentRun };
      if (path === '/manager/course-runs/run-1/sessions') return { body: sessions };
      if (path === '/manager/course-runs/resource-availability') return { body: { rooms: [{ id: 'room-1', name: 'Phòng A' }], coaches: [{ accountId: 'coach-1', fullName: 'HLV An' }] } };
      if (path === `/manager/course-runs/run-1/sessions/session-1/${endpoint}` && method === 'POST') {
        expect(body).toEqual({ expectedVersion: 1, roomId: 'room-1', coachId: 'coach-1', startAt: '2099-03-02T12:00:00.000Z', endAt: '2099-03-02T13:00:00.000Z' });
        const makeup = { ...sessions[0], id: 'makeup-1', startAt: body.startAt, endAt: body.endAt, status: 'MAKEUP_SCHEDULED', isMakeup: true, originalSessionId: 'session-1' };
        sessions = [{ ...sessions[0], status: 'CANCELLED_PENDING_MAKEUP', replacementSessionId: makeup.id }, ...sessions.slice(1), makeup];
        currentRun = { ...currentRun, plannedStartAt: sessions[1].startAt, plannedEndAt: body.endAt, version: 2 };
        return { body: { originalSession: sessions[0], makeupSession: makeup } };
      }
    });
    await page.goto('/manager/course-runs/run-1');
    await page.getByRole('row').filter({ hasText: '2/2/2099' }).getByRole('button', { name: label, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Buổi học - ngày', { exact: true })).toHaveValue('02/03/2099');
    await expect(dialog.getByLabel('Buổi học - slot', { exact: true })).toHaveValue('7');
    await expect(dialog.getByRole('button', { name: 'Lưu buổi học', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Lưu buổi học', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: '2/3/2099' })).toBeVisible();
    expect(calls.filter(c => c.path.endsWith('/' + endpoint))).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('coach teaching calendar merges PT and draft course sessions, reads all pages and opens the right details', async ({ page }) => {
  const gym = { id: 'session-1', className: 'PT lịch tuần', classType: 'PT_1_1', startTime: '2030-01-07T10:00:00Z', endTime: '2030-01-07T11:00:00Z', roomName: 'Khu PT', bookedCount: 1, capacity: 1, status: 'SCHEDULED', members: [] };
  const course = { courseSessionId: 'session-1', unitNumber: 1, courseName: 'Aerobic lịch tuần', runCode: 'NHOM-GOC-A', courseRunStatus: 'DRAFT', startsAt: '2030-01-07T12:00:00Z', endsAt: '2030-01-07T13:00:00Z', roomName: 'F1-020', rosterCount: 0, sessionStatus: 'SCHEDULED' };
  const makeup = { ...course, courseSessionId: 'makeup-1', unitNumber: 2, startsAt: '2030-01-09T14:00:00Z', endsAt: '2030-01-09T15:00:00Z', sessionStatus: 'MAKEUP_SCHEDULED' };
  const { calls, errors } = await mockApi(page, 'COACH', ({ path, url }) => {
    if (path === '/coach/class-sessions') return { body: { content: [gym], totalPages: 1 } };
    if (path === '/coach/course-sessions') {
      if (url.searchParams.get('size') === '100') return { body: { content: url.searchParams.get('page') === '1' ? [makeup] : [course], totalPages: 2 } };
      return { body: { content: [course, makeup], totalPages: 1 } };
    }
    if (path === '/coach/class-sessions/session-1') return { body: gym };
    if (path === '/coach/course-sessions/session-1') return { body: course };
    if (path === '/coach/course-sessions/session-1/roster') return { body: [] };
  });
  await page.goto('/coach/schedule?week=2030-01-07');
  await expect(page.getByRole('button', { name: 'Xem chi tiết PT lịch tuần', exact: true })).toBeVisible();
  const courseCard = page.getByRole('button', { name: 'Xem chi tiết Aerobic lịch tuần · Buổi 1', exact: true });
  await expect(courseCard).toContainText('NHOM-GOC-A');
  await expect(courseCard).toContainText('F1-020');
  await expect(courseCard).toContainText('Đã lên lịch');
  await expect(page.getByRole('button', { name: 'Xem chi tiết Aerobic lịch tuần · Buổi 2', exact: true })).toContainText('Đã xếp lịch học bù');
  for (const call of calls.filter(c => ['/coach/class-sessions', '/coach/course-sessions'].includes(c.path))) {
    expect(call.url.searchParams.get('from')).toBe('2030-01-06T17:00:00.000Z');
    expect(call.url.searchParams.get('to')).toBe('2030-01-13T17:00:00.000Z');
  }
  expect(calls.some(c => c.path === '/coach/course-sessions' && c.url.searchParams.get('page') === '1')).toBe(true);
  await page.getByRole('button', { name: 'Xem chi tiết PT lịch tuần', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('PT lịch tuần');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
  await courseCard.click();
  await expect(page).toHaveURL(/coach\/course-sessions\?session=session-1$/);
  await expect(page.getByRole('dialog')).toContainText('Aerobic lịch tuần');
  await expect(page.getByRole('dialog')).toContainText('Chưa có học viên.');
  expect(errors).toEqual([]);
});

for (const choice of ['CONTINUE', 'REQUEST_WITHDRAWAL']) {
  test(`one schedule change event with two units requires only one response: ${choice}`, async ({ page }) => {
    const currentEnrollment = { ...enrollment, sessions: [...enrollment.sessions, { ...enrollment.sessions[0], enrollmentSessionId: 'unit-2', unitNumber: 2 }] };
    let changes = [1, 2].map((n) => ({ id: `change-${n}`, enrollmentSessionId: n === 1 ? 'enrollment-session-1' : 'unit-2', changeEventId: 'batch-event', oldStartAt: nextMonth, oldEndAt: nextMonth, newStartAt: nextMonth, newEndAt: nextMonth, status: 'PENDING', responseDeadline: nextMonth, withdrawalEligible: true, cause: 'CENTER_SESSION_RESCHEDULE', refundBasisVnd: 1000000, refundAmountVnd: 1000000 }));
    const { calls, errors } = await mockApi(page, 'MEMBER', ({ path, body }) => {
      if (path === '/members/me/course-enrollments') return { body: [currentEnrollment] };
      if (path === '/members/me/course-schedule-changes') return { body: changes };
      if (path === '/members/me/course-schedule-changes/change-1/response') {
        expect(body).toEqual({ response: choice });
        changes = changes.map(change => ({ ...change, status: 'RESPONDED', response: choice, respondedAt: new Date().toISOString() }));
        return { body: changes[0] };
      }
    });
    await page.goto('/member/courses/schedule-changes');
    await expect(page.locator('#schedule-changes article')).toHaveCount(1);
    await expect(page.locator('#schedule-changes article .course-change-refund')).toContainText('1.000.000');
    await expect(page.locator('#schedule-changes article')).toContainText('Buổi 1');
    await expect(page.locator('#schedule-changes article .course-change-session')).toHaveCount(1);
    const expand = page.getByRole('button', { name: 'Xem tất cả (2 buổi)', exact: true });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(page.locator('#schedule-changes article .course-change-unit')).toHaveText(['Buổi 1', 'Buổi 2']);
    await page.getByRole('button', { name: 'Thu gọn', exact: true }).click();
    await expect(page.locator('#schedule-changes article .course-change-session')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Theo lịch mới', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: choice === 'CONTINUE' ? 'Theo lịch mới' : 'Yêu cầu hủy do đổi lịch', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(choice === 'REQUEST_WITHDRAWAL' ? 'toàn bộ đợt học này' : 'toàn bộ các buổi');
    await page.getByRole('dialog').getByRole('button', { name: choice === 'REQUEST_WITHDRAWAL' ? 'Gửi yêu cầu hủy' : 'Xác nhận theo lịch mới', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Theo lịch mới', exact: true })).toHaveCount(0);
    await expect(page.locator('#schedule-changes article')).toHaveCount(1);
    expect(calls.filter(call => call.path.endsWith('/response'))).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('schedule change comparison stays readable on desktop and mobile', async ({ page }) => {
  const e = { ...enrollment, courseName: 'Aerobic', runCode: 'NHOM-GOC-A' };
  const change = { id: 'design-change', enrollmentSessionId: 'enrollment-session-1', changeEventId: 'design-event', oldStartAt: '2099-11-23T12:00:00Z', oldEndAt: '2099-11-23T13:00:00Z', newStartAt: '2099-11-23T14:00:00Z', newEndAt: '2099-11-23T15:00:00Z', status: 'PENDING', responseDeadline: '2099-11-17T04:00:00Z', withdrawalEligible: true, refundAmountVnd: 800000 };
  await mockApi(page, 'MEMBER', ({ path }) => {
    if (path === '/members/me/course-enrollments') return { body: [e] };
    if (path === '/members/me/course-schedule-changes') return { body: [change] };
  });
  await page.goto('/member/courses/schedule-changes');
  const card = page.locator('.course-change-card');
  await expect(card.getByRole('heading', { name: 'Aerobic', exact: true })).toBeVisible();
  await expect(card).toContainText('19:00 – 20:00');
  await expect(card).toContainText('21:00 – 22:00');
  await expect(card).toContainText('800.000');
  await page.screenshot({ path: test.info().outputPath('schedule-changes-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card.getByRole('button', { name: 'Theo lịch mới', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('schedule-changes-mobile.png'), fullPage: true, animations: 'disabled' });
});
