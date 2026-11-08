import { test, expect } from '@playwright/test';

const start = '2026-11-08T03:00:00Z';
const paged = content => ({ content, page: 0, size: 20, totalPages: content.length ? 1 : 0, totalElements: content.length });

async function setup(page, course = false, writable = true) {
  let summary = { result: null, feedback: null, writable };
  let fail = false;
  const writes = [], errors = [];
  const prefix = `/coach/${course ? 'course' : 'pt'}-sessions/session-1/members/member-1/training-summary`;
  const detail = course ? { courseSessionId: 'session-1', courseName: 'Lớp sức bền', startsAt: start, endsAt: start, unitNumber: 1, sessionStatus: 'COMPLETED', attendanceWritable: false, rosterCount: 1 }
    : { id: 'session-1', classType: 'PT_1_1', className: 'PT sức mạnh', startTime: start, endTime: start, status: 'COMPLETED', members: [{ memberId: 'member-1', fullName: 'Khánh' }] };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '');
    let body, status = 200;
    if (path === '/auth/refresh') body = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'coach-1', role: 'COACH' })).toString('base64url')}.signature`, role: 'COACH', accountId: 'coach-1', fullName: 'Coach' };
    else if (path === '/notifications') body = { ...paged([]), unreadCount: 0 };
    else if (path === '/staff/me/profile') body = { role: 'COACH', fullName: 'Coach' };
    else if (path === '/coach/class-sessions/session-1' || path === '/coach/course-sessions/session-1') body = detail;
    else if (path === '/coach/course-sessions') body = paged([detail]);
    else if (path === '/coach/course-sessions/session-1/roster') body = [{ enrollmentSessionId: 'enrolled-1', memberAccountId: 'member-1', fullName: 'Khánh', memberCode: 'MB001', attendanceStatus: 'PRESENT' }];
    else if (path === '/coach/members/member-1/training-plans') body = paged([{ id: 'plan-1', title: 'Tăng sức mạnh' }]);
    else if (path.endsWith('/training-plans/plan-1/versions')) body = [{ id: 'version-1', versionNumber: 1 }];
    else if (path === prefix) {
      if (request.method() === 'GET') body = summary;
      else {
        const data = request.postDataJSON(); writes.push(data);
        if (fail) { fail = false; status = 409; body = { detail: 'Không thể lưu lúc này.' }; }
        else {
          summary = { writable: true,
            result: { id: 'result-1', activityAt: start, content: { notes: data.notes }, trainingPlanVersionId: data.trainingPlanVersionId,
              classSessionId: course ? null : 'session-1', courseSessionId: course ? 'session-1' : null },
            feedback: { id: 'feedback-1', content: data.feedback, createdAt: start,
              classSessionId: course ? null : 'session-1', courseSessionId: course ? 'session-1' : null } };
          body = summary;
        }
      }
    } else if (path === '/coach/members/member-1/training-results') body = paged(summary.result ? [summary.result] : []);
    else if (path === '/coach/members/member-1/feedback') body = paged(summary.feedback ? [summary.feedback] : []);
    else { status = 404; body = {}; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { writes, errors, fail: () => { fail = true; } };
}

test('PT records once per session, uses session time and opens the same result from member history', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/coach/schedule/session-1/members/member-1/training');
  await expect(page.getByText('Thời gian tập:')).toContainText('08/11/2026 · 10:00');
  await page.getByRole('button', { name: 'Ghi kết quả và nhận xét', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Giáo án đã tập').selectOption('version-1');
  await expect(modal.locator('input[type="datetime-local"]')).toHaveCount(0);
  await modal.getByLabel('Kết quả tập luyện').fill('Squat 40kg');
  await modal.getByLabel('Nhận xét', { exact: false }).fill('Kỹ thuật tốt');
  state.fail();
  await modal.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Không lưu được');
  await expect(modal.getByLabel('Kết quả tập luyện')).toHaveValue('Squat 40kg');
  await modal.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(state.writes.at(-1)).toEqual({ trainingPlanVersionId: 'version-1', notes: 'Squat 40kg', feedback: 'Kỹ thuật tốt' });
  await page.goto('/coach/members/member-1/training-results');
  await expect(page.getByText('Squat 40kg', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Ghi kết quả' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem buổi tập' }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kết quả và nhận xét' }).click();
  await expect(modal.getByLabel('Kết quả tập luyện')).toHaveValue('Squat 40kg');
  await modal.getByLabel('Kết quả tập luyện').fill('Squat 45kg');
  await modal.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(modal).toBeHidden();
  await page.goto('/coach/members/member-1/feedback');
  await expect(page.getByText('Kỹ thuật tốt', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Tạo nhận xét' })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('current Course roster opens training and saves without a personal plan', async ({ page }) => {
  const state = await setup(page, true);
  await page.goto('/coach/course-sessions?session=session-1');
  await page.getByRole('button', { name: 'Kết quả và nhận xét', exact: true }).click();
  await page.getByRole('button', { name: 'Ghi kết quả và nhận xét', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByLabel('Giáo án đã tập')).toHaveCount(0);
  await modal.getByLabel('Kết quả tập luyện').fill('Hoàn thành bài tập');
  await modal.getByLabel('Nhận xét', { exact: false }).fill('Sức bền tiến bộ');
  await modal.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(state.writes[0]).toEqual({ trainingPlanVersionId: null, notes: 'Hoàn thành bài tập', feedback: 'Sức bền tiến bộ' });
  await page.goto('/coach/members/member-1/feedback');
  await expect(page.getByText('Sức bền tiến bộ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem buổi khóa học' }).click();
  await expect(page.getByRole('button', { name: 'Chỉnh sửa kết quả và nhận xét' })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('unfinished or cancelled session cannot open the editor', async ({ page }) => {
  const state = await setup(page, false, false);
  await page.goto('/coach/schedule/session-1/members/member-1/training');
  await expect(page.getByRole('button', { name: 'Ghi kết quả và nhận xét' })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
