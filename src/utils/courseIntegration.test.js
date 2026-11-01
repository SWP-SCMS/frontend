import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCoursePage } from '../services/courseServiceUtils.js';
import { extractErrorMessage } from './index.js';
import { courseScheduleEntries } from './courseWorkflow.js';

test('course pagination derives the last page from the actual backend page DTO', () => {
  assert.equal(normalizeCoursePage({ content: [{ id: 'one' }], page: 0, size: 20, totalElements: 1, totalPages: 1 }).last, true);
  assert.equal(normalizeCoursePage({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }).last, true);
  assert.equal(normalizeCoursePage({ content: [], page: 0, size: 20, totalElements: 21, totalPages: 2 }).last, false);
  assert.equal(normalizeCoursePage({ content: [{ id: 'last' }], page: 1, size: 20, totalElements: 21, totalPages: 2 }).last, true);
});

test('a translated business error survives ErrorAlert formatting', () => {
  assert.equal(extractErrorMessage('Phòng hoặc huấn luyện viên đã có lịch vào thời gian này.', 'Không thể lưu'), 'Phòng hoặc huấn luyện viên đã có lịch vào thời gian này.');
  assert.equal(extractErrorMessage('   ', 'Không thể lưu'), 'Không thể lưu');
  assert.equal(extractErrorMessage(new Error('Kết nối thất bại')), 'Kết nối thất bại');
});

test('dashboard and calendar retain pending withdrawals but remove withdrawn/transferred enrollments', () => {
  const entries = ['ACTIVE', 'WITHDRAWAL_PENDING', 'WITHDRAWN', 'TRANSFERRED'].map((lifecycleStatus, index) => ({
    lifecycleStatus, courseName: 'Khóa QA', runCode: 'QA-01',
    sessions: [{ enrollmentSessionId: 'enrollment-session-' + index, courseSessionId: 'course-session-' + index,
      unitNumber: 1, disposition: 'ENROLLED', startAt: '2026-11-04T07:00:00Z', endAt: '2026-11-04T08:00:00Z' },
    { enrollmentSessionId: 'unresolved-' + index, disposition: 'UNRESOLVED' }],
  }));
  const schedule = courseScheduleEntries(entries);
  assert.equal(schedule.length, 2);
  assert.equal(schedule[1].bookingId, 'course-enrollment-session-1');
  assert.equal(schedule[0].classType, 'COURSE');
  assert.equal(schedule[0].startTime, '2026-11-04T07:00:00Z');
  assert.match(schedule[0].className, /Khóa QA · QA-01 · Buổi 1/);
});
