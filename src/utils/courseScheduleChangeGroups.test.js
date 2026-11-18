import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCourseScheduleChanges, applyCourseScheduleGroupResponse } from './courseScheduleChangeGroups.js';
const row = (id, patch = {}) => ({ id, enrollmentSessionId: `unit-${id}`, changeEventId: 'event-1', status: 'PENDING', response: null, responseDeadline: '2030-01-10T12:00:00Z', cause: 'VOLUNTARY', withdrawalEligible: true, ...patch });

test('one event produces one decision with all changed units and the earliest deadline', () => {
  const groups = groupCourseScheduleChanges([row('a'), row('b', { responseDeadline: '2030-01-09T12:00:00Z', cause: 'MEMBER_SCHEDULE_CONFLICT' })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].changes.length, 2);
  assert.equal(groups[0].id, 'b');
  assert.equal(groups[0].responseDeadline, '2030-01-09T12:00:00Z');
});

test('display uses unit order even when API order and new teaching dates differ', () => {
  const enrollments = [{ enrollmentId: 'e1', sessions: [1, 2, 3, 4].map(unitNumber => ({ enrollmentSessionId: `unit-${unitNumber}`, unitNumber })) }];
  const changes = [2, 3, 4, 1].map(n => row(String(n), { newStartAt: `2030-01-${n === 1 ? '20' : '10'}T12:00:00Z`,
    withdrawalRequestId: n === 4 ? 'withdrawal' : null }));
  const [group] = groupCourseScheduleChanges(changes, enrollments);
  assert.deepEqual(group.changes.map(change => change.id), ['1', '2', '3', '4']);
  assert.equal(group.id, '4');
  assert.deepEqual(changes.map(change => change.id), ['2', '3', '4', '1']);
});

test('without enrollment units display falls back to original teaching dates', () => {
  const [group] = groupCourseScheduleChanges([
    row('a', { oldStartAt: '2030-01-20T12:00:00Z' }),
    row('b', { oldStartAt: '2030-01-10T12:00:00Z' }),
  ]);
  assert.deepEqual(group.changes.map(change => change.id), ['b', 'a']);
});

test('group refund uses the full-refund cause ahead of an eighty-percent cause', () => {
  const [group] = groupCourseScheduleChanges([
    row('a', { cause: 'START_DELAY_OVER_7_DAYS', refundAmountVnd: 800000 }),
    row('z', { cause: 'CENTER_SESSION_RESCHEDULE', refundAmountVnd: 1000000 }),
  ]);
  assert.equal(group.id, 'z');
  assert.equal(group.refundAmountVnd, 1000000);
});

test('different events, enrollments and legacy rows never become the same decision', () => {
  const enrollments = [{ enrollmentId: 'e1', sessions: [{ enrollmentSessionId: 'unit-a' }] }, { enrollmentId: 'e2', sessions: [{ enrollmentSessionId: 'unit-b' }] }];
  assert.equal(groupCourseScheduleChanges([row('a'), row('b')], enrollments).length, 2);
  assert.equal(groupCourseScheduleChanges([row('a'), row('b', { changeEventId: 'event-2' })]).length, 2);
  assert.equal(groupCourseScheduleChanges([row('a', { changeEventId: null }), row('b', { changeEventId: null })]).length, 2);
});

test('superseded units remain history without closing the current pending group', () => {
  const groups = groupCourseScheduleChanges([row('a'), row('b', { status: 'SUPERSEDED' })]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(group => group.id === 'a').status, 'PENDING');
});

test('a successful response updates every unit in that decision and leaves later events pending', () => {
  const changes = [row('a'), row('b'), row('c', { changeEventId: 'new-event' })];
  const group = groupCourseScheduleChanges(changes)[0];
  const updated = applyCourseScheduleGroupResponse(changes, group, { ...changes[0], status: 'RESPONDED', response: 'CONTINUE' });
  assert.deepEqual(updated.map(change => change.status), ['RESPONDED', 'RESPONDED', 'PENDING']);
  assert.equal(groupCourseScheduleChanges(updated)[0].response, 'CONTINUE');
});
