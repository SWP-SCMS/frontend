import { expect } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const directory = process.env.COURSE_QA_DIRECTORY;
export const env = JSON.parse(readFileSync(path.join(directory, 'environment.json'), 'utf8'));
export const password = 'Qa-only-password-123!';
export const key = () => `qa-${randomUUID()}`;
const tokens = new Map();
let journal = [];
export function installEvidenceHooks(test) {
  test.beforeEach(async ({ page }) => {
    journal = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/v1/') && !url.pathname.startsWith('/api/v1/auth/'))
        journal.push({ via: 'UI', method: response.request().method(), path: url.pathname, actual: response.status() });
    });
  });
  test.afterEach(async ({ page }, info) => {
    // Include the final URL alongside API evidence for failed UI runs.
    await info.attach('page-url', { body: page.url(), contentType: 'text/plain' });
    await info.attach('http-evidence', { body: JSON.stringify({ title: info.title, status: info.status, backendSha: env.backendSha, requests: journal }, null, 2), contentType: 'application/json' });
  });
}
export async function api(request, role, method, endpoint, data, status = 200, idempotencyKey) {
  if (!tokens.has(role)) {
    const login = await request.post(`${env.backendUrl}/auth/login`, { data: { identifier: `${role}@course-qa.invalid`, password } });
    expect(login.status(), `login ${role}`).toBe(200);
    tokens.set(role, (await login.json()).accessToken);
  }
  const response = await request.fetch(env.backendUrl + endpoint, { method, data, headers: { Authorization: `Bearer ${tokens.get(role)}`, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } });
  const body = await response.json();
  journal.push({ via: 'API', method, path: endpoint, expected: status, actual: response.status(), errorCode: body?.code ?? null });
  expect(response.status(), `${method} ${endpoint}: ${JSON.stringify(body)}`).toBe(status);
  return body;
}
export async function login(page, role, target) {
  await page.context().clearCookies();
  await page.goto(target);
  await page.locator('#login-identifier').fill(`${role}@course-qa.invalid`);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập hệ thống SWP GYM', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(target);
}
export function clock(instant) {
  writeFileSync(path.join(directory, 'clock.next'), new Date(instant).toISOString());
  renameSync(path.join(directory, 'clock.next'), path.join(directory, 'clock.txt'));
  tokens.clear();
}
export const receptionBase = () => `/reception/members/${env.accounts.member.accountId}`;
export async function cash(request, fixture) {
  return api(request, 'reception', 'POST', `${receptionBase()}/course-orders/${fixture.orderId}/payments/cash`, undefined, 200, key());
}
export async function enrollment(request, runId) {
  return (await api(request, 'member', 'GET', '/members/me/course-enrollments')).find(e => e.courseRunId === runId);
}
export async function evidence(info, value) {
  await info.attach('verified-state', { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
}



export async function newRun(request, { day, tuition = 500000, capacity = 1, units = 1 }) {
  const base = await api(request, 'manager', 'GET', `/manager/course-runs/${env.fixtures.waitlist.runId}`);
  const original = await api(request, 'manager', 'GET', `/manager/course-runs/${base.id}/sessions`);
  const now = Date.now(); const start = now + day * 86400000;
  const iso = ms => new Date(ms).toISOString();
  let run = await api(request, 'manager', 'POST', '/manager/course-runs', { runCode: key(), courseId: base.courseId, primaryCoachId: base.primaryCoachId, tuitionVnd: tuition, capacity, minimumEnrollment: 1, registrationOpensAt: iso(now - 3600000), registrationClosesAt: iso(now + 3600000), plannedStartAt: iso(start), plannedEndAt: iso(start + (units + 2) * 3600000), totalUnits: units, namedCoachCommitment: true }, 201);
  for (let i=0; i<units; i++) await api(request, 'manager', 'POST', `/manager/course-runs/${run.id}/sessions`, { unitNumber: i+1, roomId: original[0].roomId, coachId: base.primaryCoachId, startAt: iso(start + i*3600000), endAt: iso(start + (i+1)*3600000), allocationVnd: Math.floor(tuition / units) }, 201);
  run = await api(request, 'manager', 'GET', `/manager/course-runs/${run.id}`);
  return api(request, 'manager', 'POST', `/manager/course-runs/${run.id}/open-registration`, { expectedVersion: run.version, policyVersion: 'QA-P1' });
}
export async function buy(request, run, member = 'member') {
  const order = await api(request, member, 'POST', '/members/me/course-orders', { courseRunId: run.id }, 201, key());
  await api(request, 'reception', 'POST', `/reception/members/${env.accounts[member].accountId}/course-orders/${order.orderId}/payments/cash`, undefined, 200, key());
  return order;
}
