import { test, expect } from '@playwright/test';

const pageOf = content => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, last: true });

test.describe('coach leave dates', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
  test('dd/mm date entry sends ISO timestamps in the gym timezone', async ({ page }) => {
    const writes = [];
    let rows = [];
    await mock(page, 'COACH', (path, url, route) => {
      if (path === '/coach/me/leave-requests') return rows;
      if (path === '/coach/leave-requests' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        writes.push(body);
        const created = { id: 'leave-1', ...body, status: 'PENDING', createdAt: body.startTime, affectedSessionIds: [] };
        rows = [created];
        return created;
      }
    });
    await page.goto('/coach/leave-requests');
    const from = page.getByRole('textbox', { name: 'Từ thời điểm - ngày', exact: true });
    const to = page.getByRole('textbox', { name: 'Đến thời điểm - ngày', exact: true });
    await expect(from).toHaveAttribute('placeholder', 'dd/mm/yyyy');
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
    await from.fill('31/02/2030');
    await page.getByLabel('Từ thời điểm - giờ', { exact: true }).fill('08:00');
    await to.fill('09/11/2030');
    await page.getByLabel('Đến thời điểm - giờ', { exact: true }).fill('09:00');
    await page.getByLabel('Lý do').fill('Nghỉ có việc riêng');
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(page.getByRole('alert')).toContainText('ngày hợp lệ');
    expect(writes).toHaveLength(0);
    await from.fill('09/11/2030');
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(page.getByText('Đã gửi yêu cầu nghỉ.', { exact: true })).toBeVisible();
    expect(writes).toEqual([{ startTime: '2030-11-09T01:00:00.000Z', endTime: '2030-11-09T02:00:00.000Z', reason: 'Nghỉ có việc riêng' }]);
    await expect(page.locator('tbody')).toContainText('09/11/2030 08:00');
    await expect(page.locator('tbody')).toContainText('09/11/2030 09:00');
  });
});

test('date editing preserves day month and year while typing and deleting', async ({ page }) => {
  await mock(page, 'MANAGER', path => {
    if (path === '/manager/course-runs' || path === '/manager/courses') return pageOf([]);
  });
  await page.goto('/manager/course-runs');
  await page.getByRole('button', { name: '+ Tạo đợt mở', exact: true }).click();
  const date = page.locator('#weekly-opening');
  await date.pressSequentially('7/11/2026');
  await expect(date).toHaveValue('7/11/2026');
  await date.press('Tab');
  await expect(date).toHaveValue('07/11/2026');
  await date.focus();
  await date.evaluate(el => el.setSelectionRange(0, 2));
  await date.press('Backspace');
  await expect(date).toHaveValue('/11/2026');
  await date.pressSequentially('8');
  await expect(date).toHaveValue('8/11/2026');
  await date.press('Tab');
  await expect(date).toHaveValue('08/11/2026');
  await date.fill('31122026');
  await date.press('Tab');
  await expect(date).toHaveValue('31/12/2026');
  const opens = page.getByRole('textbox', { name: 'Mở đăng ký - ngày', exact: true });
  await opens.pressSequentially('7/11/2026');
  await opens.press('Tab');
  await expect(opens).toHaveValue('07/11/2026');
  await page.locator('#registrationOpensAt-time').fill('09:00');
  await expect(opens).toHaveValue('07/11/2026');
  await date.fill('31/02/2026');
  await date.press('Tab');
  await expect(date).toHaveValue('31/02/2026');
  const calendar = date.locator('..').locator('input[type="date"]');
  await calendar.evaluate(el => {
    el.showPicker = () => { el.dataset.opened = 'true'; };
  });
  await calendar.click();
  await expect(calendar).toHaveAttribute('data-opened', 'true');
  await calendar.fill('2026-12-15');
  await expect(date).toHaveValue('15/12/2026');
  await date.fill('16/12/2026');
  await expect(calendar).toHaveValue('2026-12-16');
});
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

test('session summary saves both fields once and keeps draft on failure', async ({ page }) => {
  await page.clock.install();
  let result = null, feedback = null, fail = true;
  const writes = [];
  const base = '/coach/class-sessions/session-1/members/member-1';
  await mock(page, 'COACH', async (path, url, route) => {
    if (path === '/coach/class-sessions/session-1') return { id: 'session-1', classType: 'GROUP', className: 'Yoga QA', startTime: '2026-11-01T01:00:00Z', endTime: '2026-11-01T02:00:00Z', status: 'COMPLETED', members: [{ memberId: 'member-1', fullName: 'Hội viên QA' }] };
    if (!path.startsWith(base)) return;
    if (route.request().method() === 'GET') {
      const value = path.endsWith('/training-results') ? result : feedback;
      if (!value) { await route.fulfill({ status: 204 }); return 'handled'; }
      return value;
    }
    expect(path).toBe(base + '/training-summary');
    expect(route.request().method()).toBe('PUT');
    writes.push(route.request().postDataJSON());
    if (fail) { await route.fulfill({ status: 409, json: { code: 'SESSION_TRAINING_NOT_AVAILABLE' } }); return 'handled'; }
    result = { id: 'result-1', content: { notes: writes.at(-1).notes } };
    feedback = { id: 'feedback-1', content: writes.at(-1).feedback };
    return { result, feedback };
  });
  await page.goto('/coach/schedule/session-1/members/member-1/training');
  await page.getByRole('button', { name: 'Ghi kết quả và nhận xét', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kết quả tập luyện', { exact: true }).fill('Hoàn thành ba hiệp');
  await dialog.getByLabel('Nhận xét', { exact: true }).fill('Tiến bộ tốt');
  await page.screenshot({ path: 'test-results/session-summary-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/session-summary-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.runFor(8000);
  await expect(dialog.getByLabel('Nhận xét', { exact: true })).toHaveValue('Tiến bộ tốt');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Kết quả tập luyện', { exact: true })).toHaveValue('Hoàn thành ba hiệp');
  expect(writes).toHaveLength(1);
  fail = false;
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  await expect(page.getByRole('status')).toContainText('Đã lưu kết quả và nhận xét');
  await page.getByRole('button', { name: 'Chỉnh sửa kết quả và nhận xét', exact: true }).click();
  await expect(dialog.getByLabel('Nhận xét', { exact: true })).toHaveValue('Tiến bộ tốt');
  await dialog.getByLabel('Kết quả tập luyện', { exact: true }).fill('Hoàn thành bốn hiệp');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(3);
  await page.reload();
  await expect(page.getByText('Hoàn thành bốn hiệp', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiến bộ tốt', { exact: true })).toBeVisible();
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

test('member card status is a compact rounded badge for an inactive membership', async ({ page }) => {
  await mock(page, 'MEMBER', path => {
    if (path === '/members/me/memberships') return [];
    if (path === '/members/me/profile') return { accountId: 'qa', memberId: 'MB-100070', role: 'MEMBER', fullName: 'Nguyễn Văn A' };
  });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('/member/courses');
  const badge = page.locator('.scms-app-card-status');
  await expect(badge).toHaveText('Chưa kích hoạt gói tập');
  await expect(badge).toHaveCSS('display', 'inline-block');
  await expect(badge).toHaveCSS('border-radius', '8px');
  await expect(badge).toHaveCSS('background-color', 'rgb(237, 240, 243)');
  const box = await badge.boundingBox();
  const card = await page.locator('.scms-app-card').boundingBox();
  expect(box.width).toBeLessThan(card.width - 32);
  await page.screenshot({ path: 'test-results/member-card-status.png', fullPage: true });
});


test('recurring rooms must fit every occurrence and refresh on capacity changes', async ({ page }) => {
  let fail = false;
  const queries = [];
  const errors = await mock(page, 'MANAGER', async (path, url, route) => {
    if (path === '/manager/classes/class-room-test') return { id: 'class-room-test', name: 'Yoga', status: 'ACTIVE', type: 'GROUP' };
    if (path === '/manager/rooms/availability') {
      queries.push(Object.fromEntries(url.searchParams));
      if (fail) {
        await route.fulfill({ status: 500, json: { message: 'Không tải được phòng' } });
        return 'handled';
      }
      const capacity = Number(url.searchParams.get('requestedCapacity'));
      const second = url.searchParams.get('startTime').startsWith('2030-01-14');
      return [
        { roomId: 'always', name: 'Phòng luôn trống', capacity: 30, available: capacity <= 30 },
        { roomId: 'sometimes', name: 'Phòng trùng buổi sau', capacity: 30, available: !second },
      ];
    }
  });
  await page.goto('/manager/classes/class-room-test/recurring-schedules/new');
  const room = page.locator('#rsc-roomId');
  await expect(room).toBeDisabled();
  await page.locator('#rsc-slot').selectOption('2');
  await page.locator('#rsc-startDate').fill('07/01/2030');
  await page.locator('#rsc-weekday-1').check();
  await page.locator('#rsc-sessionCount').fill('2');
  await page.locator('#rsc-capacity').fill('10');
  await expect(room.locator('option[value="always"]')).toHaveCount(1);
  await expect(room.locator('option[value="sometimes"]')).toHaveCount(0);
  expect(queries.some(q => q.startTime.startsWith('2030-01-14'))).toBeTruthy();
  await room.selectOption('always');
  await page.locator('#rsc-capacity').fill('40');
  await expect(room).toHaveValue('');
  await expect(room).toBeEnabled();
  await expect(room.locator('option[value="always"]')).toHaveCount(0);
  await expect(room).toContainText('Không có phòng phù hợp cho toàn bộ lịch');
  fail = true;
  await page.locator('#rsc-capacity').fill('20');
  await expect(page.getByText('Không tải được danh sách phòng tập', { exact: true })).toBeVisible();
  await expect(room.locator('option')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Tạo lịch cố định', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});


test('course run availability uses every preview window and invalidates stale choices', async ({ page }) => {
  const requests = [];
  let fail = false;
  const windows = [{ unitNumber: 1, startAt: '2030-01-07T03:00:00Z', endAt: '2030-01-07T04:00:00Z' }, { unitNumber: 2, startAt: '2030-01-14T03:00:00Z', endAt: '2030-01-14T04:00:00Z' }];
  const errors = await mock(page, 'MANAGER', async (path, url, route) => {
    if (path === '/manager/courses') return pageOf([{ id: 'course', name: 'Yoga', code: 'Y', status: 'PUBLISHED' }]);
    if (path === '/manager/course-runs') return pageOf([]);
    if (path.endsWith('/preview-schedule')) return { sessions: windows, plannedEndAt: windows[1].endAt };
    if (path.endsWith('/resource-availability')) {
      const payload = route.request().postDataJSON(); requests.push(payload);
      if (fail) { await route.fulfill({ status: 500, json: {} }); return 'handled'; }
      return { rooms: payload.capacity <= 20 ? [{ id: 'r', name: 'Phòng phù hợp', capacity: 20 }] : [], coaches: [{ accountId: 'c', fullName: 'HLV phù hợp' }] };
    }
  });
  await page.goto('/manager/course-runs');
  await page.getByRole('button', { name: /Tạo đợt mở/ }).click();
  await expect(page.locator('#weekly-room')).toBeDisabled();
  await page.locator('#weekly-capacity').fill('10');
  await page.locator('#weekly-units').fill('2');
  await page.locator('#weekly-opening').fill('07/01/2030');
  await page.locator('#weekly-day-1').check();
  await page.locator('#weekly-slot').selectOption('2');
  await expect(page.locator('#weekly-room option[value="r"]')).toHaveCount(1);
  expect(requests.at(-1).windows).toEqual(windows.map(({ startAt, endAt }) => ({ startAt, endAt })));
  await page.locator('#weekly-room').selectOption('r');
  await page.locator('#weekly-coach').selectOption('c');
  await page.locator('#weekly-capacity').fill('30');
  await expect(page.locator('#weekly-room')).toHaveValue('');
  await expect(page.locator('#weekly-room')).toContainText('Không có phòng phù hợp');
  await expect(page.getByRole('button', { name: 'Tạo đợt và lịch học' })).toBeDisabled();
  fail = true;
  await page.locator('#weekly-capacity').fill('15');
  await expect(page.getByText('Không tải được HLV và phòng trống')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('#weekly-room option[value="r"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('editing course session excludes itself from availability', async ({ page }) => {
  const requests = [];
  const errors = await mock(page, 'MANAGER', (path, url, route) => {
    if (path === '/manager/course-runs/run') return { id: 'run', runCode: 'RUN', courseName: 'Yoga', capacity: 20, totalUnits: 1, status: 'DRAFT' };
    if (path === '/manager/course-runs/run/sessions') return [{ id: 's', unitNumber: 1, roomId: 'r', coachId: 'c', startAt: '2030-01-07T03:00:00Z', endAt: '2030-01-07T04:00:00Z', status: 'SCHEDULED', allocationVnd: 100 }];
    if (path.endsWith('/resource-availability')) {
      requests.push(route.request().postDataJSON());
      return { rooms: [{ id: 'r', name: 'Phòng cũ', capacity: 20 }], coaches: [{ accountId: 'c', fullName: 'HLV cũ' }] };
    }
  });
  await page.goto('/manager/course-runs/run');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await expect(page.locator('#course-session-roomId')).toBeEnabled();
  expect(requests.at(-1).excludeSessionId).toBe('s');
  await expect(page.locator('#course-session-roomId')).toHaveValue('r');
  await expect(page.locator('#course-session-coachId')).toHaveValue('c');
  await page.getByLabel('Buổi học - slot', { exact: true }).selectOption('3');
  await expect.poll(() => requests.at(-1).windows[0].startAt).toBe('2030-01-07T04:00:00.000Z');
  expect(errors).toEqual([]);
});


test('single session filters rooms only after schedule and capacity and clears stale choices', async ({ page }) => {
  let fail = false;
  const errors = await mock(page, 'MANAGER', async (path, url, route) => {
    if (path === '/manager/classes/single') return { id: 'single', name: 'Yoga', status: 'ACTIVE', type: 'GROUP' };
    if (path === '/manager/rooms') return [{ id: 'r', name: 'Phòng trống', status: 'ACTIVE', capacity: 20 }];
    if (path === '/manager/coaches/available') return [{ coachAccountId: 'c', fullName: 'HLV trống' }];
    if (path === '/manager/rooms/availability') {
      if (fail) { await route.fulfill({ status: 500, json: {} }); return 'handled'; }
      return [{ roomId: 'r', name: 'Phòng trống', capacity: 20, available: Number(url.searchParams.get('requestedCapacity')) <= 20 }, { roomId: 'busy', name: 'Phòng bận', capacity: 30, available: false }];
    }
  });
  await page.goto('/manager/classes/single/sessions/new');
  const room = page.locator('#ssc-roomId');
  await expect(room).toBeDisabled();
  await expect(page.locator('#ssc-slot option')).toHaveCount(9);
  await expect(page.locator('#ssc-slot option').last()).toHaveText('Slot 8 · 21:00–22:00');
  await page.locator('#ssc-slot').selectOption('2');
  await page.locator('#ssc-sessionDate').fill('07/01/2030');
  await expect(room).toBeDisabled();
  await expect(room.locator('option[value="r"]')).toHaveCount(0);
  await page.locator('#ssc-capacity').fill('10');
  await expect(room.locator('option[value="r"]')).toHaveCount(1);
  await expect(room.locator('option[value="busy"]')).toHaveCount(0);
  await room.selectOption('r');
  await page.locator('#ssc-capacity').fill('25');
  await expect(room).toHaveValue('');
  await expect(room).toContainText('Không có phòng phù hợp');
  await expect(page.getByRole('button', { name: 'Tạo buổi tập', exact: true })).toBeDisabled();
  fail = true;
  await page.locator('#ssc-capacity').fill('15');
  await expect(page.getByText('Không kiểm tra được phòng khả dụng')).toBeVisible();
  await expect(room).toBeDisabled();
  await expect(room.locator('option[value="r"]')).toHaveCount(0);
  const order = await page.locator('form select, form input').evaluateAll(nodes => nodes.map(n => n.id));
  expect(order.indexOf('ssc-slot')).toBeLessThan(order.indexOf('ssc-capacity'));
  expect(order.indexOf('ssc-capacity')).toBeLessThan(order.indexOf('ssc-roomId'));
  expect(order.indexOf('ssc-roomId')).toBeLessThan(order.indexOf('ssc-coachId'));
  expect(errors).toEqual([]);
});


test('calendar aligns shared start times and stacks simultaneous sessions', async ({ page }) => {
  const sessions = [
    ['a','2026-11-09','10:00','11:00'], ['b','2026-11-09','10:00','11:30'],
    ['c','2026-11-10','07:00','08:30'], ['d','2026-11-09','17:00','18:00'],
    ['e','2026-11-15','17:00','18:00'],
  ].map(([id,date,start,end]) => ({ id, classId: 'class', coachId: 'coach', roomId: 'room', startTime: `${date}T${start}:00+07:00`, endTime: `${date}T${end}:00+07:00`, capacity: 20, bookedCount: 0, status: 'SCHEDULED' }));
  await mock(page, 'MANAGER', path => {
    if (path === '/manager/class-sessions') return pageOf(sessions);
    if (path === '/manager/classes') return [{ id: 'class', name: 'Aerobic cơ bản', status: 'ACTIVE' }];
    if (path === '/manager/rooms') return [{ id: 'room', name: 'F1-021', status: 'ACTIVE' }];
  });
  await page.goto('/manager/class-sessions?week=2026-11-09');
  const rows = page.locator('.msl-cal-body');
  await expect(rows).toHaveCount(11);
  await expect(page.locator('.msl-cal-time-label').filter({ hasText: /^Slot / })).toHaveCount(8);
  await expect(page.locator('.msl-cal-session')).toHaveCount(5);
  const cells = await page.locator('.msl-cal-body[data-start-time="17:00"]').getByRole('gridcell').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
  expect(new Set(cells).size).toBe(1);
  await page.locator('.msl-cal').screenshot({ path: 'test-results/calendar-time-rows.png' });
});


for (const role of ['MEMBER', 'COACH']) {
  test(`${role} calendar displays slots and expands each cell independently`, async ({ page }) => {
    const sessions = ['a','b'].map(id => ({ id, classSessionId: id, className: 'Yoga', startTime: '2030-01-07T02:00:00Z', endTime: '2030-01-07T03:00:00Z', status: role === 'MEMBER' ? 'BOOKED' : 'SCHEDULED', capacity: 20, bookedCount: 1 }));
    const errors = await mock(page, role, path => {
      if (path === '/members/me/bookings' || path === '/coach/class-sessions') return pageOf(sessions);
    });
    await page.goto(`${role === 'MEMBER' ? '/member/class-sessions' : '/coach/schedule'}?week=2030-01-07`);
    await expect(page.locator('.mcs-cal-slot')).toHaveCount(8);
    const cell = page.getByRole('gridcell').filter({ has: page.getByRole('button', { name: 'Xem tất cả 2 lớp ▾' }) });
    await expect(cell).toHaveCount(1);
    await cell.getByRole('button', { name: 'Xem tất cả 2 lớp ▾' }).click();
    await expect(page.getByRole('button', { name: 'Thu gọn ▴' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Thu gọn ▴' }).click();
    await expect(page.getByRole('button', { name: 'Xem tất cả 2 lớp ▾' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}


test('member course calendar shows room and coach before the course starts', async ({ page }) => {
  const errors = await mock(page, 'MEMBER', path => {
    if (path === '/members/me/bookings') return pageOf([]);
    if (path === '/members/me/course-enrollments') return [{ id: 'e', courseName: 'Aerobic', runCode: 'AERO-01', lifecycleStatus: 'ACTIVE', courseRunStatus: 'CONFIRMED', sessions: [{ enrollmentSessionId: 'es', courseSessionId: 'cs', unitNumber: 1, startAt: '2030-01-07T08:00:00Z', endAt: '2030-01-07T09:00:00Z', disposition: 'ENROLLED', sessionStatus: 'SCHEDULED', attendanceStatus: 'NOT_RECORDED', roomName: 'F1-020', coachName: 'HLV Aerobic' }] }];
  });
  await page.goto('/member/class-sessions?week=2030-01-07');
  const card = page.getByRole('button', { name: /Xem chi tiết Aerobic/ });
  await expect(card).toContainText('F1-020');
  await expect(card).toContainText('HLV Aerobic');
  await card.click();
  await expect(page.getByRole('dialog')).toContainText('F1-020');
  await expect(page.getByRole('dialog')).toContainText('HLV Aerobic');
  expect(errors).toEqual([]);
});

for (const state of ['future', 'running', 'cancelled']) {
  test(`session training locks results and feedback for ${state} sessions`, async ({ page }) => {
    await page.clock.install({ time: new Date('2030-01-07T10:00:00Z') });
    await mock(page, 'COACH', async path => {
      if (path === '/coach/class-sessions/locked') return {
        id: 'locked', classType: 'GROUP', className: 'Lớp QA',
        startTime: state === 'future' ? '2030-01-07T11:00:00Z' : '2030-01-07T09:00:00Z',
        endTime: state === 'cancelled' ? '2030-01-07T09:59:00Z' : '2030-01-07T12:00:00Z',
        status: state === 'cancelled' ? 'CANCELLED' : 'SCHEDULED',
        members: [{ memberId: 'member', fullName: 'Hội viên QA' }],
      };
      if (path.endsWith('/training-results')) return { id: 'result', content: { notes: 'Kết quả cũ' } };
      if (path.endsWith('/feedback')) return { id: 'feedback', content: 'Nhận xét cũ' };
    });
    await page.goto('/coach/schedule/locked/members/member/training');
    const edit = page.getByRole('button', { name: 'Chỉnh sửa kết quả và nhận xét', exact: true });
    await expect(edit).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('main .card')).toHaveCount(1);
    if (state !== 'cancelled') {
      await page.clock.fastForward(2 * 60 * 60 * 1000);
      await expect(edit).toBeEnabled();
      await edit.click();
      await expect(page.getByLabel('Kết quả tập luyện', { exact: true })).toBeEnabled();
      await expect(page.getByLabel('Nhận xét', { exact: true })).toBeEnabled();
    }
  });
}

for (const [role, profilePath] of [['MANAGER', '/manager/profile'], ['RECEPTIONIST', '/reception/profile'], ['COACH', '/coach/profile']]) {
  test(`staff profile contact and image workflow ${role}`, async ({ page }) => {
    let profile = { accountId: 'qa', role, status: 'ACTIVE', fullName: 'Nguyen Van A', phone: '0901234567', email: 'qa@example.com', birthDate: '1990-01-01', profileImageUrl: null };
    const writes = [];
    await mock(page, role, async (path, url, route) => {
      if (path.startsWith('/profile-images/')) {
        await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8e0AAAAASUVORK5CYII=', 'base64') });
        return 'handled';
      }
      if (path === '/staff/me/profile/image') {
        profile = { ...profile, profileImageUrl: route.request().method() === 'DELETE' ? null : '/profile-images/qa.png' };
        return profile;
      }
      if (path !== '/staff/me/profile') return;
      if (route.request().method() === 'PATCH') {
        writes.push(route.request().postDataJSON());
        profile = { ...profile, ...writes.at(-1) };
      }
      return profile;
    });
    await page.goto(profilePath);
    await page.getByLabel('Tên người liên hệ', { exact: true }).fill('Nguyen Van B');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Vui lòng nhập cả tên và số điện thoại người liên hệ.')).toBeVisible();
    expect(writes).toHaveLength(0);
    await page.locator('#staff-contact-phone').fill('0909876543');
    await page.getByLabel('Mối quan hệ', { exact: true }).fill('Anh trai');
    await page.getByLabel('Tải ảnh từ máy').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8e0AAAAASUVORK5CYII=', 'base64') });
    await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Ảnh đại diện Nguyen Van A', exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên người liên hệ', { exact: true })).toHaveValue('Nguyen Van B');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Đã cập nhật hồ sơ cá nhân.', { exact: true })).toBeVisible();
    expect(writes).toEqual([{ emergencyContactName: 'Nguyen Van B', emergencyContactPhone: '0909876543', emergencyContactRelationship: 'Anh trai' }]);
    await page.reload();
    await expect(page.getByLabel('Mối quan hệ', { exact: true })).toHaveValue('Anh trai');
    await page.screenshot({ path: `test-results/staff-profile-${role}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/staff-profile-${role}-mobile.png` });
    await page.getByRole('button', { name: 'Xóa ảnh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Xóa ảnh', exact: true })).toHaveCount(0);
    await page.getByLabel('Tên người liên hệ', { exact: true }).fill('');
    await page.locator('#staff-contact-phone').fill('');
    await page.getByLabel('Mối quan hệ', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Đã cập nhật hồ sơ cá nhân.', { exact: true })).toBeVisible();
    expect(writes.at(-1)).toEqual({ emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '' });
  });
}
