import { test, expect } from '@playwright/test';

const start = '2026-11-17T03:00:00Z';
const end = '2026-11-17T04:00:00Z';
const calendar = '/member/class-sessions?week=2026-11-16';
const summaryPath = kind => `/members/me/${kind === 'course' ? 'course' : 'class'}-sessions/${kind}-session/training-summary`;

async function setup(page) {
  const state = { reads: [], errors: [], fail: false, summaries: {} };
  for (const kind of ['pt', 'class', 'course']) state.summaries[kind] = {
    result: { id: `${kind}-result`, content: { notes: `${kind} kết quả\nHoàn thành bài tập` } },
    feedback: { id: `${kind}-feedback`, content: `${kind} nhận xét\nTiến bộ tốt` },
  };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body = [], status = 200;
    if (path === '/auth/refresh') body = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'member-1', role: 'MEMBER' })).toString('base64url')}.signature`, role: 'MEMBER', accountId: 'member-1', fullName: 'Hội viên kiểm thử' };
    else if (path === '/members/me/profile') body = { accountId: 'member-1', role: 'MEMBER', fullName: 'Hội viên kiểm thử' };
    else if (path === '/notifications') body = { content: [], totalPages: 0, unreadCount: 0 };
    else if (path === '/members/me/bookings') body = { content: [
      { bookingId: 'pt-booking', sessionId: 'pt-session', classType: 'PT_1_1', className: 'PT sức mạnh', startTime: start, endTime: end, coachName: 'An' },
      { bookingId: 'class-booking', sessionId: 'class-session', classType: 'YOGA', className: 'Yoga buổi chiều', startTime: '2026-11-17T07:00:00Z', endTime: '2026-11-17T08:00:00Z', coachName: 'Bình' },
    ], totalPages: 1 };
    else if (path === '/members/me/course-enrollments') body = [{
      enrollmentId: 'enrollment', courseName: 'Khóa bơi', runCode: 'BOI-01', lifecycleStatus: 'COMPLETED', courseRunStatus: 'COMPLETED',
      sessions: [{ enrollmentSessionId: 'enrollment-session', courseSessionId: 'course-session', unitNumber: 1,
        disposition: 'ENROLLED', sessionStatus: 'COMPLETED', startAt: '2026-11-18T01:00:00Z', endAt: '2026-11-18T02:00:00Z', coachName: 'Chi' }],
    }];
    else if (path.endsWith('/training-summary')) {
      state.reads.push(path);
      const kind = ['pt', 'class', 'course'].find(value => path === summaryPath(value));
      if (state.fail) { status = 500; body = { code: 'INTERNAL_ERROR' }; }
      else if (kind) body = state.summaries[kind];
      else { status = 404; body = {}; }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return state;
}

for (const [kind, name] of [['pt', 'PT sức mạnh'], ['class', 'Yoga buổi chiều'], ['course', 'Khóa bơi']]) {
  test(`${kind}: member opens calendar session, reads both fields and sees coach updates after reload`, async ({ page }) => {
    const state = await setup(page);
    await page.goto(calendar);
    const button = page.getByRole('button', { name: `Xem chi tiết ${name}`, exact: kind !== 'course' });
    await expect(button).toBeVisible();
    expect(state.reads).toEqual([]);
    await button.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Kết quả tập luyện' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Nhận xét của HLV' })).toBeVisible();
    await expect(dialog).toContainText(`${kind} kết quả`);
    await expect(dialog).toContainText(`${kind} nhận xét`);
    await expect(dialog.locator('.mcs-mfeedback-text').last()).toHaveCSS('white-space', 'pre-wrap');
    expect(state.reads.every(path => path === summaryPath(kind))).toBe(true);
    state.summaries[kind].feedback.content = `${kind} nhận xét đã sửa`;
    await page.reload();
    await button.click();
    await expect(dialog).toContainText(`${kind} nhận xét đã sửa`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await expect(dialog).toHaveCSS('opacity', '1');
    await page.screenshot({ path: test.info().outputPath(`${kind}-calendar-mobile.png`), fullPage: true, animations: 'disabled' });
    expect(state.errors).toEqual([]);
  });
}

test('load failure offers retry without claiming the coach has not written anything', async ({ page }) => {
  const state = await setup(page);
  state.fail = true;
  await page.goto(calendar);
  await page.getByRole('button', { name: 'Xem chi tiết PT sức mạnh', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Không tải được kết quả và nhận xét');
  await expect(dialog.getByText(/HLV chưa/)).toHaveCount(0);
  state.fail = false;
  state.summaries.pt.feedback = null;
  await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(dialog).toContainText('pt kết quả');
  await expect(dialog).toContainText('HLV chưa gửi nhận xét cho buổi này.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('opening another session never reuses the previous session content', async ({ page }) => {
  const state = await setup(page);
  await page.goto(calendar);
  await page.getByRole('button', { name: 'Xem chi tiết PT sức mạnh', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('pt nhận xét');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  state.summaries.class = { result: null, feedback: null };
  await page.getByRole('button', { name: 'Xem chi tiết Yoga buổi chiều', exact: true }).click();
  await expect(dialog).toContainText('HLV chưa ghi kết quả cho buổi này.');
  await expect(dialog).toContainText('HLV chưa gửi nhận xét cho buổi này.');
  await expect(dialog).not.toContainText('pt nhận xét');
});

test('deep link opens a completed course session in its historical week', async ({ page }) => {
  await setup(page);
  await page.goto('/member/class-sessions?week=2030-01-01&sessionId=course-session');
  await expect(page.getByRole('dialog')).toContainText('course nhận xét');
  await expect(page).toHaveURL(/week=2026-11-18/);
});

test('retired member history routes redirect to the calendar and redundant sidebar entries are gone', async ({ page }) => {
  await setup(page);
  for (const path of ['feedback', 'training-results']) {
    for (const suffix of ['', '/pt', '/classes', '/courses']) {
      await page.goto(`/member/${path}${suffix}`);
      await expect(page).toHaveURL(/\/member\/class-sessions/);
      await expect(page.getByRole('heading', { name: 'Lịch của tôi', exact: true })).toBeVisible();
    }
  }
  for (const label of ['Lịch tập', 'Huấn luyện cá nhân', 'Khóa học']) {
    const group = page.locator('details').filter({ has: page.locator('summary').getByText(label, { exact: true }) });
    if (!(await group.evaluate(node => node.open))) await group.locator('summary').click();
    await expect(group.locator('.scms-app-navitem').filter({ hasText: /Nhận xét|Đánh giá|Kết quả/ })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: 'Lịch của tôi', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Giáo án tập luyện', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Khóa học của tôi', exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/member/feedback"], a[href^="/member/training-results"]')).toHaveCount(0);
});
