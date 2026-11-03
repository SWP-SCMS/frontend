import { test, expect } from '@playwright/test';
import { api, login, newRun, buy, enrollment, evidence } from './support.js';
import { installEvidenceHooks } from './support.js';
installEvidenceHooks(test);

test('SYSTEM_CLOCK registration shows effective makeup schedule without counting cancelled original', async ({ page, request }, info) => {
  const run = await newRun(request, { day: 10, units: 2 });
  await buy(request, run);
  const sessions = await api(request, 'manager', 'GET', `/manager/course-runs/${run.id}/sessions`);
  const original = sessions.find(s => s.unitNumber === 1);
  const start = Date.parse(original.startAt) + 7200000;
  const result = await api(request, 'manager', 'POST', `/manager/course-runs/${run.id}/sessions/${original.id}/cancel-with-makeup`, { expectedVersion: original.version, roomId: original.roomId, coachId: run.primaryCoachId, startAt: new Date(start).toISOString(), endAt: new Date(start+3600000).toISOString() });
  expect(result.originalSession.replacementSessionId).toBe(result.makeupSession.id);
  const timeline = await enrollment(request, run.id);
  expect(timeline.sessions.find(s => s.isMakeup).originalSessionId).toBe(original.id);
  await login(page, 'member', `/member/courses/${run.id}/register`);
  await expect(page.getByText('2 buổi', { exact: true })).toBeVisible();
  await expect(page.locator('.member-course-session-row')).toHaveCount(2);
  await expect(page.getByText('Đã hủy (buổi gốc)', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Đã xếp lịch học bù', { exact: true })).toBeVisible();
  await evidence(info, { totalUnits: 2, historicalSessions: 3, timelineMakeupLinkVerifiedByAPI: true, registrationShowsOnlyEffectiveSessions: true, clock: 'SYSTEM_CLOCK' });
});
