import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveCourseSessions } from './courseUi.js';
test('effective schedule excludes cancelled and unserved originals without dropping completed makeup', () => {
  const sessions = ['CANCELLED_PENDING_MAKEUP', 'MAKEUP_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'UNRESOLVED', 'RESOLVED_BY_REFUND'].map((status, id) => ({ id, status }));
  assert.deepEqual(effectiveCourseSessions(sessions).map(s => s.id), [1,2,3]);
  assert.equal(sessions.length, 6);
  assert.deepEqual(effectiveCourseSessions(), []);
});
