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


const course = { id: 'course-1', code: 'QA', name: 'Khóa đã tải', status: 'DRAFT', version: 1, defaultMinimumEnrollment: 1 };

test('returning to a list shows cached data while revalidating and keeps form drafts', async ({ page }) => {
  let hold = false, release, calls = 0;
  const errors = await mock(page, 'MANAGER', async (path, url, route) => {
    if (path === '/manager/courses/course-1') return course;
    if (path.endsWith('/disciplines')) return [];
    if (path !== '/manager/courses') return;
    calls++;
    if (hold) {
      await new Promise(resolve => { release = async () => { await route.fulfill({ json: pageOf([{ ...course, name: 'Khóa mới từ BE' }]) }); resolve(); }; });
      return 'handled';
    }
    return pageOf([course]);
  });
  await page.goto('/manager/courses');
  await expect(page.getByText(course.name, { exact: true })).toBeVisible();
  await page.locator('a[href="/manager/courses/course-1"]').click();
  await expect(page.getByRole('heading', { name: course.name })).toBeVisible();
  hold = true;
  const baseline = calls;
  await page.getByRole('link', { name: '← Quay lại danh mục' }).click();
  await expect.poll(() => calls).toBeGreaterThan(baseline);
  await expect(page.getByText(course.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Tạo khóa học' }).click();
  await page.getByLabel('Tên khóa học *', { exact: true }).fill('Bản nháp giữ nguyên');
  await release();
  await expect(page.getByText('Khóa mới từ BE', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên khóa học *', { exact: true })).toHaveValue('Bản nháp giữ nguyên');
  expect(errors).toEqual([]);
});

test('successful mutation invalidates list cache; failed mutation does not', async ({ page }) => {
  let fail = true, hold = false, release;
  await mock(page, 'MANAGER', async (path, url, route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill(fail ? { status: 409, json: { code: 'CONFLICT' } } : { json: course });
      return 'handled';
    }
    if (path === '/manager/courses/course-1') return course;
    if (path !== '/manager/courses') return;
    if (hold) {
      await new Promise(resolve => { release = async () => { await route.fulfill({ json: pageOf([{ ...course, name: 'Sau cập nhật' }]) }); resolve(); }; });
      return 'handled';
    }
    return pageOf([course]);
  });
  await page.goto('/manager/courses');
  await expect(page.getByText(course.name, { exact: true })).toBeVisible();
  const count = () => page.evaluate(async () => {
    const { readQueryCache } = await import('/src/utils/queryCache.js');
    return !!readQueryCache(JSON.stringify(['MANAGER', 'qa', ['manager-courses', 0]]));
  });
  await expect.poll(count).toBe(true);
  const mutate = () => page.evaluate(async () => {
    const { default: api } = await import('/src/services/api.js');
    await api.patch('/manager/courses/course-1', {}).catch(() => {});
  });
  await mutate();
  expect(await count()).toBe(true);
  fail = false;
  await mutate();
  expect(await count()).toBe(false);
  await page.locator('a[href="/manager/courses/course-1"]').click();
  await expect(page.getByRole('heading', { name: course.name })).toBeVisible();
  hold = true;
  await page.getByRole('link', { name: '← Quay lại danh mục' }).click();
  await expect.poll(() => !!release).toBe(true);
  await expect(page.getByText(course.name, { exact: true })).toHaveCount(0);
  await release();
  await expect(page.getByText('Sau cập nhật', { exact: true })).toBeVisible();
});

test('pagination uses separate snapshots and account change clears them', async ({ page }) => {
  let hold = false, release;
  await mock(page, 'MANAGER', async (path, url, route) => {
    if (path !== '/manager/courses') return;
    const number = Number(url.searchParams.get('page') || 0);
    const data = { ...pageOf([{ ...course, id: `c-${number}`, name: `Trang ${number} QA` }]), page: number, totalPages: 2, totalElements: 21, last: number === 1 };
    if (hold && number === 0) {
      await new Promise(resolve => { release = async () => { await route.fulfill({ json: data }); resolve(); }; });
      return 'handled';
    }
    return data;
  });
  await page.goto('/manager/courses');
  await expect(page.getByText('Trang 0 QA', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByText('Trang 1 QA', { exact: true })).toBeVisible();
  hold = true;
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  await expect(page.getByText('Trang 0 QA', { exact: true })).toBeVisible();
  await expect(page.getByText('Trang 1 QA', { exact: true })).toHaveCount(0);
  await release();
  await page.evaluate(async () => {
    const { setAccessToken } = await import('/src/services/api.js');
    setAccessToken(null);
  });
  expect(await page.evaluate(async () => {
    const { readQueryCache } = await import('/src/utils/queryCache.js');
    return readQueryCache(JSON.stringify(['MANAGER', 'qa', ['manager-courses', 0]])) === undefined;
  })).toBe(true);
});
