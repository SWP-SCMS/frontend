import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyScheduleSchema, weeklyCourseRunSchema, weeklyRunPayload } from '../schemas/courseWeeklySchema.js';

const schedule = { openingDate: '2099-02-02', weekdays: [1, 3, 5], startTime: '18:00', endTime: '19:00', totalUnits: '4' };
const run = { runCode: 'QA', courseId: 'course', primaryCoachId: 'coach', roomId: 'room', tuitionVnd: '1001', capacity: '10', minimumEnrollment: '2', namedCoachCommitment: true, registrationOpensAt: '2099-01-01T08:00', registrationClosesAt: '2099-02-01T18:00', schedule };

test('weekly run sends ISO weekdays and Vietnam instants without a manual end date', () => {
  const payload = weeklyRunPayload(weeklyCourseRunSchema.parse(run));
  assert.deepEqual(payload.schedule.weekdays, [1, 3, 5]);
  assert.equal(payload.schedule.totalUnits, 4);
  assert.equal(payload.registrationOpensAt, '2099-01-01T01:00:00.000Z');
  assert.equal(payload.registrationClosesAt, '2099-02-01T11:00:00.000Z');
  assert.equal('plannedEndAt' in payload, false);
});

test('weekly calendar rejects nonselected opening weekday, invalid dates and overnight hours', () => {
  for (const patch of [{ openingDate: '2099-02-03' }, { openingDate: '2099-02-31' }, { weekdays: [] }, { endTime: '17:00' }, { startTime: '25:00' }, { totalUnits: 0 }, { totalUnits: 367 }]) {
    assert.equal(weeklyScheduleSchema.safeParse({ ...schedule, ...patch }).success, false, JSON.stringify(patch));
  }
});

test('registration and capacity constraints reject invalid requests', () => {
  for (const patch of [{ minimumEnrollment: 11 }, { tuitionVnd: 3 }, { registrationClosesAt: '2099-02-03T18:00' }, { registrationClosesAt: '2098-12-31T18:00' }, { registrationOpensAt: '2099-02-31T08:00' }]) {
    assert.equal(weeklyCourseRunSchema.safeParse({ ...run, ...patch }).success, false, JSON.stringify(patch));
  }
});
