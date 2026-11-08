import { test, expect } from '@playwright/test';

const pageOf = content => ({ content, page: 0, size: 20, totalPages: 1, totalElements: content.length });
const request = { id: 'leave-1', coachId: 'coach-1', coachFullName: 'Em Rô Bích', coachPhone: '0900000000', status: 'PENDING',
  startTime: '2030-11-09T00:00:00Z', endTime: '2030-11-14T16:59:00Z', reason: 'Khám bệnh', createdAt: '2030-11-08T01:00:00Z' };
const session = { id: 'class-1', type: 'CLASS', name: 'Aerobic cơ bản', startTime: '2030-11-10T01:00:00Z', endTime: '2030-11-10T02:00:00Z',
  coachId: 'coach-1', coachName: 'Em Rô Bích', roomId: 'room-1', roomName: 'F1-020', memberCount: 3, capacity: 15,
  status: 'SCHEDULED', version: 2, canReassign: true, canReschedule: true, canCancel: true };

async function setup(page, initial = [session]) {
  let sessions = [...initial], status = 'PENDING', staleApproval = false, failedMutation = false;
  const writes = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1', '');
    let body, code = 200;
    const summary = () => ({ ...request, status, affectedSessionIds: sessions.map(item => item.id) });
    if (path === '/auth/refresh') body = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'manager-1', role: 'MANAGER' })).toString('base64url')}.signature`, role: 'MANAGER', accountId: 'manager-1', fullName: 'Manager' };
    else if (path === '/notifications') body = { ...pageOf([]), unreadCount: 0 };
    else if (path === '/staff/me/profile') body = { role: 'MANAGER', fullName: 'Manager' };
    else if (path === '/manager/coach-leave-requests') body = pageOf([summary()]);
    else if (path === '/manager/coach-leave-requests/leave-1/impact') body = { request: summary(), sessions };
    else if (path.endsWith('/batch')) {
      const payload = req.postDataJSON(); writes.push({ path, body: payload });
      sessions = sessions.filter(item => !payload.sessions.some(selected => selected.id === item.id && selected.type === item.type));
      body = { processedCount: payload.sessions.length };
    }
    else if (path.endsWith('/available-coaches')) body = [{ coachAccountId: 'coach-2', fullName: 'HLV thay thế' }];
    else if (path === '/manager/course-runs/resource-availability') body = { coaches: [{ accountId: 'coach-2', fullName: 'HLV thay thế' }], rooms: [{ id: 'room-1', name: 'F1-020', capacity: 15 }] };
    else if (path.endsWith('/approve')) {
      writes.push({ path, body: req.postDataJSON() });
      if (staleApproval) { staleApproval = false; sessions = [{ ...session, id: 'new-session' }]; code = 409; body = { code: 'COACH_LEAVE_HAS_AFFECTED_SESSIONS' }; }
      else { status = 'APPROVED'; body = summary(); }
    } else if (req.method() === 'PATCH' || path.endsWith('/cancel')) {
      writes.push({ path, body: req.postDataJSON() });
      if (failedMutation) { failedMutation = false; code = 409; body = { code: 'SESSION_VERSION_CONFLICT', detail: 'Dữ liệu đã thay đổi.' }; }
      else { const id = path.includes('course-runs') ? path.split('/')[5] : path.split('/')[3]; sessions = sessions.filter(item => item.id !== id); body = {}; }
    } else { code = 404; body = {}; }
    await route.fulfill({ status: code, json: body });
  });
  return { writes, errors, stale: () => { staleApproval = true; }, fail: () => { failedMutation = true; } };
}

test('manager resolves exact class and course from leave, then explicitly approves', async ({ page }) => {
  const state = await setup(page, [session, { ...session, id: 'course-1', type: 'COURSE', name: 'Aerobic khóa 1', courseRunId: 'run-1', runCode: 'AERO-01', unitNumber: 2, version: 5 }]);
  await page.goto('/manager/coach-leave-requests');
  await page.getByRole('button', { name: 'Xử lý 2 buổi' }).click();
  await expect(page.getByRole('heading', { name: 'Còn 2 buổi cần xử lý' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('leave-impact-desktop.png'), fullPage: true, animations: 'disabled' });
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeDisabled();
  const classRow = page.getByRole('row').filter({ hasText: 'Aerobic cơ bản' });
  await classRow.getByRole('button', { name: 'Đổi HLV' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('10/11/2030');
  await modal.getByLabel('HLV thay thế').selectOption('coach-2');
  state.fail();
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Buổi tập đã được cập nhật');
  await expect(modal.getByLabel('HLV thay thế')).toHaveValue('coach-2');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Còn 1 buổi cần xử lý' })).toBeVisible();
  expect(state.writes[1].body).toEqual({ coachId: 'coach-2', expectedVersion: 2 });
  await page.getByRole('tab', { name: 'Buổi thuộc khóa học' }).click();
  await page.getByRole('row').filter({ hasText: 'Buổi 2' }).getByRole('button', { name: 'Đổi HLV' }).click();
  await modal.getByLabel('HLV thay thế').selectOption('coach-2');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeEnabled();
  expect(state.writes.at(-1)).toEqual({ path: '/manager/course-runs/run-1/sessions/course-1', body: {
    expectedVersion: 5, coachId: 'coach-2', roomId: 'room-1', startAt: session.startTime, endAt: session.endTime,
  } });
  expect(state.writes.some(write => write.path.endsWith('/approve'))).toBe(false);
  await page.getByRole('button', { name: 'Duyệt nghỉ', exact: true }).click();
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByText('Đã duyệt yêu cầu nghỉ.', { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('approval conflict reloads newly affected sessions and blocks confirmation', async ({ page }) => {
  const state = await setup(page, []);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByRole('button', { name: 'Duyệt nghỉ', exact: true }).click();
  state.stale();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal.getByRole('alert').first()).toContainText('Vừa phát sinh');
  await expect(modal.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  await modal.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByRole('heading', { name: 'Còn 1 buổi cần xử lý' })).toBeVisible();
});

test('empty class cancellation calls the existing cancellation API', async ({ page }) => {
  const state = await setup(page, [{ ...session, memberCount: 0 }]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByRole('button', { name: 'Hủy buổi', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('0 học viên');
  await expect(modal).toContainText('học viên được thông báo');
  await modal.getByLabel('Lý do', { exact: false }).fill('Coach xin nghỉ, không có người thay');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeEnabled();
  expect(state.writes[0]).toEqual({ path: '/manager/class-sessions/class-1/cancel', body: { reason: 'Coach xin nghỉ, không có người thay' } });
});

test('course cancellation works without a makeup schedule', async ({ page }) => {
  const state = await setup(page, [{ ...session, id: 'course-1', type: 'COURSE', memberCount: 0, courseRunId: 'run-1', runCode: 'AERO-01', unitNumber: 1 }]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByRole('tab', { name: 'Buổi thuộc khóa học' }).click();
  await expect(page.getByRole('button', { name: 'Dời lịch', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hủy và xếp bù' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hủy buổi', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('0 học viên');
  await expect(modal).toContainText('Không tạo buổi bù');
  await expect(modal.getByLabel('Ngày bắt đầu')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeEnabled();
  expect(state.writes).toEqual([{ path: '/manager/course-runs/run-1/sessions/course-1/cancel', body: { expectedVersion: 2 } }]);
});

for (const type of ['CLASS', 'PT', 'COURSE']) {
  test(`${type} with registered members cannot be cancelled`, async ({ page }) => {
    const state = await setup(page, [{ ...session, type, memberCount: 1, canCancel: true }]);
    await page.goto('/manager/coach-leave-requests/leave-1');
    await page.getByRole('tab', { name: { CLASS: 'Buổi lớp thường', PT: 'Buổi PT', COURSE: 'Buổi thuộc khóa học' }[type] }).click();
    await expect(page.getByRole('button', { name: 'Hủy buổi', exact: true })).toBeDisabled();
    await expect(page.getByText('Đã có hội viên đăng ký, không được hủy. Vui lòng đổi HLV.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đổi HLV', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeDisabled();
    expect(state.writes).toEqual([]);
  });
}

const nextSession = { ...session, id: 'class-2', startTime: '2030-11-11T01:00:00Z', endTime: '2030-11-11T02:00:00Z' };

test('bulk reassignment resolves all selected sessions and still requires explicit approval', async ({ page }) => {
  const state = await setup(page, [session, nextSession]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByLabel('Chọn tất cả trong tab', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'Hủy buổi đã chọn', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Đổi HLV đã chọn', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('HLV thay thế cho tất cả buổi').selectOption('coach-2');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toContainText('Đã xử lý toàn bộ 2 buổi');
  expect(state.writes).toEqual([{ path: '/manager/coach-leave-requests/leave-1/batch', body: { sessions: [{ type: 'CLASS', id: 'class-1', expectedVersion: 2 }, { type: 'CLASS', id: 'class-2', expectedVersion: 2 }], action: 'reassign', coachId: 'coach-2', reason: null } }]);
  await modal.getByRole('button', { name: 'Đóng và tải lại' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeEnabled();
});

test('bulk cancellation selects only empty sessions', async ({ page }) => {
  const state = await setup(page, [session, { ...nextSession, memberCount: 0 }]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByRole('button', { name: 'Chọn buổi có thể hủy (1)' }).click();
  await page.getByRole('button', { name: 'Hủy buổi đã chọn', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('11/11/2030');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toContainText('Đã xử lý toàn bộ 1 buổi');
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe('/manager/coach-leave-requests/leave-1/batch');
  expect(state.writes[0].body.sessions).toEqual([{ type: 'CLASS', id: 'class-2', expectedVersion: 2 }]);
  expect(state.writes[0].body.action).toBe('cancel');
  await modal.getByRole('button', { name: 'Đóng và tải lại' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeDisabled();
});

test('overlapping sessions cannot be assigned to one coach', async ({ page }) => {
  const state = await setup(page, [session, { ...session, id: 'class-2' }]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByLabel('Chọn tất cả trong tab', { exact: true }).check();
  await page.getByRole('button', { name: 'Đổi HLV đã chọn', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Các buổi đã chọn trùng giờ nhau');
  await expect(modal.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('bulk reassignment conflict leaves all sessions unchanged', async ({ page }) => {
  const state = await setup(page, [session, nextSession]);
  let attempts = 0;
  await page.route('**/manager/coach-leave-requests/leave-1/batch', route => { attempts++; return route.fulfill({ status: 409, json: { code: 'COACH_LEAVE_BATCH_FAILED', detail: 'Buổi class-2 bị trùng lịch.' } }); });
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByLabel('Chọn tất cả trong tab', { exact: true }).check();
  await page.getByRole('button', { name: 'Đổi HLV đã chọn', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('HLV thay thế cho tất cả buổi').selectOption('coach-2');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(modal).toContainText('Không cập nhật buổi nào');
  await modal.getByRole('button', { name: 'Đóng và tải lại' }).click();
  await expect(page.getByRole('heading', { name: 'Còn 2 buổi cần xử lý' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt nghỉ', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  expect(attempts).toBe(1);
});

test('replacement options are the intersection of all selected sessions', async ({ page }) => {
  const state = await setup(page, [session, nextSession]);
  await page.route('**/batch/available-coaches', route => route.fulfill({ json: [] }));
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByLabel('Chọn tất cả trong tab', { exact: true }).check();
  await page.getByRole('button', { name: 'Đổi HLV đã chọn', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Không có HLV phù hợp với toàn bộ các buổi');
  await expect(modal.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('course sessions are grouped by run and selection is cleared when switching tabs', async ({ page }) => {
  await setup(page, [session, { ...session, id: 'course-1', type: 'COURSE', courseRunId: 'run-1', runCode: 'AERO-01', unitNumber: 2 },
    { ...nextSession, id: 'course-2', type: 'COURSE', courseRunId: 'run-2', runCode: 'AERO-02', unitNumber: 1 }]);
  await page.goto('/manager/coach-leave-requests/leave-1');
  await page.getByLabel('Chọn tất cả trong tab', { exact: true }).check();
  await page.getByRole('tab', { name: 'Buổi thuộc khóa học' }).click();
  await expect(page.getByText('Đã chọn 0 buổi', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Đợt AERO-01' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Đợt AERO-02' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('leave-grouped-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('leave-grouped-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
