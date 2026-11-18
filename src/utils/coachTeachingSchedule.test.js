import test from 'node:test';
import assert from 'node:assert/strict';
import { courseTeachingEntries } from './coachTeachingSchedule.js';

const session = { courseSessionId: 'same-id', unitNumber: 2, courseName: 'Aerobic', runCode: 'NHOM-A', courseRunStatus: 'DRAFT', startsAt: '2030-01-07T12:00:00Z', endsAt: '2030-01-07T13:00:00Z', roomName: 'F1-020', rosterCount: 3, sessionStatus: 'SCHEDULED' };

test('tentative and open course sessions appear on the teaching calendar with distinct identities', () => {
  for (const courseRunStatus of ['DRAFT', 'OPEN_FOR_REGISTRATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']) {
    const [entry] = courseTeachingEntries([{ ...session, courseRunStatus }]);
    assert.equal(entry.id, 'course-same-id');
    assert.equal(entry.courseSessionId, 'same-id');
    assert.equal(entry.startTime, session.startsAt);
    assert.equal(entry.endTime, session.endsAt);
    assert.equal(entry.className, 'Aerobic · Buổi 2');
    assert.equal(entry.runCode, 'NHOM-A');
    assert.equal(entry.bookedCount, 3);
  }
});

test('makeups appear while cancelled, replaced and removed timetable entries are excluded', () => {
  const entries = courseTeachingEntries(['MAKEUP_SCHEDULED', 'COMPLETED', 'CANCELLED', 'CANCELLED_PENDING_MAKEUP', 'REMOVED_BY_RUN_CHANGE', 'UNRESOLVED', 'RESOLVED_BY_REFUND'].map(sessionStatus => ({ ...session, sessionStatus })));
  assert.deepEqual(entries.map(entry => entry.status), ['MAKEUP_SCHEDULED', 'COMPLETED']);
  assert.deepEqual(courseTeachingEntries([{ ...session, courseRunStatus: 'CANCELLED' }]), []);
});
