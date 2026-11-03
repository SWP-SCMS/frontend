import { test, expect } from '@playwright/test';
import { env, api, login, key, buy, newRun, enrollment, receptionBase, evidence } from './support.js';
import { installEvidenceHooks } from './support.js';
installEvidenceHooks(test);

test('SYSTEM_CLOCK Reception waitlist join/leave/accept, owner guard and cash fulfillment', async ({ page, request }, info) => {
  const run = await newRun(request, { day: 2 });
  await buy(request, run);
  const base = `/reception/members/${env.accounts.member2.accountId}`;
  let w = await api(request, 'reception', 'POST', `${base}/course-runs/${run.id}/waitlist`, undefined, 201);
  expect(w.status).toBe('WAITING');
  await api(request, 'reception', 'POST', `${base}/course-runs/${run.id}/waitlist`, undefined, 409);
  w = await api(request, 'reception', 'DELETE', `${base}/course-runs/${run.id}/waitlist`); expect(w.status).toBe('LEFT');
  w = await api(request, 'reception', 'POST', `${base}/course-runs/${run.id}/waitlist`, undefined, 201);
  const e = await enrollment(request, run.id);
  const withdrawal = await api(request, 'member', 'POST', `/members/me/course-enrollments/${e.enrollmentId}/withdrawal-requests`, { reason: 'QA release slot' }, 201);
  await api(request, 'manager', 'POST', `/manager/course-withdrawal-requests/${withdrawal.id}/approve`, { reason: 'QA release slot' });
  await expect.poll(async () => (await api(request, 'member2', 'GET', '/members/me/course-waitlists')).find(x => x.id === w.id)?.status, { timeout: 45000 }).toBe('INVITED');
  await api(request, 'reception', 'POST', `${receptionBase()}/course-waitlists/${w.id}/accept`, undefined, 404, key());
  await login(page, 'reception', '/reception/courses');
  await page.getByLabel('Mã hội viên hoặc số điện thoại').fill(env.accounts.member2.memberCode);
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  page.once('dialog', async d => { expect(d.message()).toContain('Nhận chỗ'); await d.accept(); });
  await page.getByRole('button', { name: 'Nhận chỗ / mở đơn', exact: true }).click();
  await page.getByRole('link', { name: 'Mở đơn để thanh toán tiền mặt/chuyển khoản' }).click();
  await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
  await expect(page.getByText('Đã thanh toán khóa học.', { exact: true })).toBeVisible();
  const mine = await api(request, 'member2', 'GET', '/members/me/course-enrollments');
  expect(mine.filter(e => e.courseRunId === run.id)).toHaveLength(1);
  await evidence(info, { waitlist: 'WAITING → LEFT → WAITING → INVITED → ACCEPTED', enrollmentCount: 1, ownerMismatch: 404 });
});

for (const [name, day, tuition] of [['cheaper', 4, 300000], ['expensive', 7, 700000]]) {
  test(`SYSTEM_CLOCK ${name} transfer: real schedule response, Reception confirmation, difference settlement`, async ({ page, request }, info) => {
    const source = await newRun(request, { day });
    const target = await newRun(request, { day: day + 1, tuition });
    const order = await buy(request, source);
    const e = await enrollment(request, source.id);
    let sessions = await api(request, 'manager', 'GET', `/manager/course-runs/${source.id}/sessions`);
    const session = sessions[0];
    const move = ms => new Date(Date.parse(ms) + 3600000).toISOString();
    await api(request, 'manager', 'PATCH', `/manager/course-runs/${source.id}/sessions/${session.id}`, { expectedVersion: session.version, startAt: move(session.startAt), endAt: move(session.endAt), roomId: session.roomId, coachId: source.primaryCoachId });
    const changes = await api(request, 'member', 'GET', '/members/me/course-schedule-changes');
    const change = changes.find(c => c.enrollmentSessionId === e.sessions[0].enrollmentSessionId && c.status === 'PENDING'); expect(change).toBeTruthy();
    await api(request, 'reception', 'POST', `${receptionBase()}/course-schedule-changes/${change.id}/response`, { response: 'REQUEST_TRANSFER' });
    const requests = await api(request, 'manager', 'GET', '/manager/course-transfer-requests');
    const transfer = requests.find(t => t.sourceEnrollmentId === e.enrollmentId);
    const offer = await api(request, 'manager', 'POST', `/manager/course-transfer-requests/${transfer.id}/approve`, { targetRunId: target.id, reason: 'QA synthetic transfer' });
    expect(offer.differenceVnd).toBe(tuition - 500000);
    await login(page, 'reception', `/reception/courses?orderId=${order.orderId}&memberCode=${env.accounts.member.memberCode}`);
    page.once('dialog', async d => { expect(d.message()).toContain('Chấp nhận chuyển'); expect(d.message()).toContain('Chênh lệch học phí'); expect(d.message()).not.toContain('Yêu cầu rút'); await d.accept(); });
    await page.getByRole('button', { name: 'Chấp nhận chuyển hộ', exact: true }).click();
    if (tuition > 500000) {
      await page.getByRole('link', { name: 'Mở đơn để thanh toán tiền mặt/chuyển khoản' }).click();
      await expect(page.getByText('200.000 ₫', { exact: false }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Xác nhận đã nhận đủ tiền mặt', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận thu tiền', exact: true }).click();
      await expect(page.getByText('Đã thanh toán khóa học.', { exact: true })).toBeVisible();
    }
    await expect.poll(async () => (await enrollment(request, source.id)).lifecycleStatus).toBe('TRANSFERRED');
    expect((await enrollment(request, target.id)).lifecycleStatus).toBe('ACTIVE');
    await expect(page.getByRole('row').filter({ hasText: target.runCode }).getByRole('button', { name: 'Yêu cầu rút hộ', exact: true })).toBeEnabled();
    if (tuition < 500000) {
      let refund = (await api(request, 'manager', 'GET', '/manager/course-refund-obligations')).items.find(r => r.enrollmentId === e.enrollmentId && r.source === 'TRANSFER_CREDIT_EXCESS');
      expect(refund.grossObligationVnd).toBe(200000);
      refund = await api(request, 'manager', 'POST', `/manager/course-refund-obligations/${refund.id}/approve`, { expectedVersion: refund.version, reason: 'QA cheaper run' });
      refund = await api(request, 'reception', 'POST', `/reception/course-refund-obligations/${refund.id}/disburse`, { expectedVersion: refund.version, amountVnd: 200000, method: 'CASH', reference: 'QA-CASH-NO-MONEY', evidenceReference: 'QA' }, 200, key());
      refund = await api(request, 'manager', 'POST', `/manager/course-refund-obligations/${refund.id}/verify`, { expectedVersion: refund.version, amountVnd: 200000, disbursementReference: 'QA-CASH-NO-MONEY', evidenceReference: 'QA', reason: 'QA verified' });
      expect(refund.status).toBe('COMPLETED');
    }
    await evidence(info, { source: 'TRANSFERRED', target: 'ACTIVE', difference: tuition - 500000, UIConfirmation: 'transfer-specific', fulfillment: 'paid difference or verified refund' });
  });
}
