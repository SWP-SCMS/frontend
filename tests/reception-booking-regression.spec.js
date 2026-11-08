import { test, expect } from '@playwright/test';

test('receptionist opens booking management from member lookup without a runtime error', async ({ page }) => {
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  const accountId = '11111111-1111-4111-8111-111111111111';
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const profile = { accountId, memberId: 'MB-100070', fullName: 'Hội viên kiểm thử', status: 'ACTIVE', phone: '0901010101' };
  const pageOf = content => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1', '');
    let body;
    if (path === '/auth/refresh') body = { accessToken: `mock.${Buffer.from(JSON.stringify({ sub: 'reception-1', role: 'RECEPTIONIST' })).toString('base64url')}.signature`, role: 'RECEPTIONIST', accountId: 'reception-1', fullName: 'Lễ tân' };
    else if (path === '/notifications') body = { ...pageOf([]), unreadCount: 0 };
    else if (path === '/staff/me/profile') body = { role: 'RECEPTIONIST', fullName: 'Lễ tân' };
    else if (path === '/reception/members/search' || path.endsWith('/profile')) body = profile;
    else if (path.endsWith('/memberships')) body = [{ status: 'ACTIVE', benefitCodes: ['CLASS_BOOKING'] }];
    else if (path === '/reception/class-sessions') body = pageOf([{ id: sessionId, className: 'Aerobic kiểm thử', classType: 'GROUP', startTime: '2035-11-10T01:00:00Z', endTime: '2035-11-10T02:00:00Z', availableCapacity: 10, capacity: 10, bookedCount: 0, bookingAvailable: true, requiredBenefitCodes: ['CLASS_BOOKING'] }]);
    else if (path === '/reception/pt-sessions') body = pageOf([]);
    else if (path === `/reception/members/${accountId}/bookings`) {
      if (req.method() === 'POST') { writes.push(req.postDataJSON()); body = { bookingId: 'booking-1' }; }
      else body = pageOf([]);
    } else { await route.fulfill({ status: 404, json: {} }); return; }
    await route.fulfill({ json: body });
  });
  await page.goto('/reception/members?phone=0901010101');
  await page.getByRole('button', { name: 'Đặt / quản lý lịch', exact: true }).click();
  await expect(page).toHaveURL(/reception\/members\/MB-100070\/bookings/);
  await expect(page.getByRole('heading', { name: 'Đặt / quản lý lịch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chọn buổi tập', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Xác nhận đặt lịch', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('Đã đặt Aerobic kiểm thử cho hội viên MB-100070.')).toBeVisible();
  expect(writes).toEqual([{ sessionId }]);
  expect(errors).toEqual([]);
});
