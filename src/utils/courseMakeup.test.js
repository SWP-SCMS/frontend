import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestCourseMakeup } from './courseMakeup.js';

const now = Date.parse('2026-11-14T00:00:00Z');
const unit = (date, extra = {}) => ({ startAt: `${date}T12:00:00Z`, endAt: `${date}T13:00:00Z`, status: 'SCHEDULED', ...extra });
const weekly = ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'].map(date => unit(date));

test('weekly Monday course suggests next Monday after the last unit in Vietnam time', () => {
  assert.deepEqual(suggestCourseMakeup(weekly, now), { startAt: '2026-12-21T19:00', endAt: '2026-12-21T20:00' });
});

test('multiple weekdays use the next teaching weekday rather than blindly adding seven days', () => {
  const sessions = ['2026-11-23', '2026-11-25', '2026-11-27'].map(date => unit(date));
  assert.equal(suggestCourseMakeup(sessions, now).startAt, '2026-11-30T19:00');
});

test('already scheduled makeup extends the tail without changing the weekly pattern', () => {
  const sessions = [...weekly, unit('2026-12-21', { isMakeup: true, status: 'MAKEUP_SCHEDULED' })];
  assert.equal(suggestCourseMakeup(sessions, now).startAt, '2026-12-28T19:00');
});

test('removed units and cancelled makeups do not extend the tail', () => {
  const sessions = [...weekly, unit('2026-12-28', { status: 'REMOVED_BY_RUN_CHANGE' }), unit('2027-01-06', { isMakeup: true, status: 'CANCELLED_PENDING_MAKEUP' })];
  assert.equal(suggestCourseMakeup(sessions, now).startAt, '2026-12-21T19:00');
});

test('a cancelled last original still occupies its original planned date', () => {
  const sessions = weekly.map((s, i) => i === 3 ? { ...s, status: 'CANCELLED_PENDING_MAKEUP' } : s);
  assert.equal(suggestCourseMakeup(sessions, now).startAt, '2026-12-21T19:00');
});

test('suggestion stays in the future if the original course ended long ago', () => {
  assert.equal(suggestCourseMakeup(weekly, Date.parse('2027-01-05T00:00:00Z')).startAt, '2027-01-11T19:00');
});

test('weekly pattern uses Vietnam weekdays when the UTC date is different', () => {
  const sessions = [{ startAt: '2026-11-22T17:30:00Z', endAt: '2026-11-22T18:30:00Z', status: 'SCHEDULED' }];
  assert.deepEqual(suggestCourseMakeup(sessions, now), { startAt: '2026-11-30T00:30', endAt: '2026-11-30T01:30' });
});

test('missing timetable leaves the form available for manual scheduling', () => {
  assert.equal(suggestCourseMakeup([], now), null);
  assert.equal(suggestCourseMakeup([{ startAt: null, endAt: null }], now), null);
});
