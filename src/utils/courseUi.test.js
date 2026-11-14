import test from 'node:test';
import assert from 'node:assert/strict';
import { courseEnrollmentStatusLabel, effectiveCourseSessions } from './courseUi.js';
import { isHistoricalCourse } from './courseHistory.js';

test('cancelled runs cannot present active or pending enrollments as still studying', () => {
  for (const lifecycleStatus of ['ACTIVE', 'WITHDRAWAL_PENDING']) {
    const enrollment = { lifecycleStatus, courseRunStatus: 'CANCELLED' };
    assert.equal(courseEnrollmentStatusLabel(enrollment), 'Đã hủy');
    assert.equal(isHistoricalCourse(enrollment), true);
  }
});

test('enrollment labels preserve withdrawal outcomes and pending review on a completed run', () => {
  for (const [lifecycleStatus, courseRunStatus, label, history] of [
    ['ACTIVE', 'IN_PROGRESS', 'Đang theo học', false],
    ['ACTIVE', 'COMPLETED', 'Đã hoàn thành', true],
    ['WITHDRAWAL_PENDING', 'COMPLETED', 'Chờ xử lý yêu cầu rút', false],
    ['WITHDRAWN', 'CANCELLED', 'Đã rút', true],
    ['TRANSFERRED', 'CANCELLED', 'Đã chuyển đợt học', true],
  ]) {
    const enrollment = { lifecycleStatus, courseRunStatus };
    assert.equal(courseEnrollmentStatusLabel(enrollment), label);
    assert.equal(isHistoricalCourse(enrollment), history);
  }
});
test('effective schedule excludes cancelled and unserved originals without dropping completed makeup', () => {
  const sessions = ['CANCELLED_PENDING_MAKEUP', 'MAKEUP_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'UNRESOLVED', 'RESOLVED_BY_REFUND'].map((status, id) => ({ id, status }));
  assert.deepEqual(effectiveCourseSessions(sessions).map(s => s.id), [1,2,3]);
  assert.equal(sessions.length, 6);
  assert.deepEqual(effectiveCourseSessions(), []);
});
