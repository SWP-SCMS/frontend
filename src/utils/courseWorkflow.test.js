import assert from 'node:assert/strict';
import test from 'node:test';
import { courseRefundActions, canAcceptCourseTransfer, canRespondToCourseChange, courseAmountText, courseMakeupIds, courseNotificationDestination } from './courseWorkflow.js';
import { formatCourseMoney, formatCourseDateTime, getCourseErrorMessage } from './courseUi.js';
import { courseDecisionSchema, courseTransferDecisionSchema, courseVerificationSchema } from '../schemas/courseWorkflowSchemas.js';

test('refund decisions follow backend transitions and cannot imply a disbursement', () => {
  assert.deepEqual(courseRefundActions('PENDING_REVIEW'), ['approve', 'reject']);
  assert.deepEqual(courseRefundActions('APPROVED'), ['fail']);
  assert.deepEqual(courseRefundActions('DISBURSEMENT_RECORDED'), ['verify', 'fail', 'return']);
  assert.deepEqual(courseRefundActions('PENDING_VERIFICATION'), ['verify', 'fail', 'return']);
  for (const status of ['COMPLETED', 'FAILED', 'RETURNED', 'REJECTED', undefined]) assert.deepEqual(courseRefundActions(status), []);
});

test('a response is unavailable at its deadline or after any terminal/superseded state', () => {
  const deadline = '2026-11-10T10:00:00Z';
  const pending = { status: 'PENDING', responseDeadline: deadline };
  const now = Date.parse(deadline);
  assert.equal(canRespondToCourseChange(pending, now - 1), true);
  assert.equal(canRespondToCourseChange(pending, now), false);
  for (const status of ['RESPONDED', 'SUPERSEDED', 'EXPIRED']) assert.equal(canRespondToCourseChange({ ...pending, status }, now - 1), false);
  assert.equal(canRespondToCourseChange({ ...pending, response: 'CONTINUE' }, now - 1), false);
  assert.equal(canRespondToCourseChange({ ...pending, responseDeadline: null }, now - 1), false);
});

test('only unaccepted, unexpired offers can be accepted', () => {
  const offer = { status: 'OFFERED', expiresAt: '2026-11-10T10:00:00Z' };
  const now = Date.parse(offer.expiresAt);
  assert.equal(canAcceptCourseTransfer(offer, now - 1), true);
  assert.equal(canAcceptCourseTransfer(offer, now), false);
  assert.equal(canAcceptCourseTransfer({ ...offer, acceptedAt: '2026-11-01T00:00:00Z' }, now - 1), false);
  for (const status of ['PENDING_PAYMENT', 'EXPIRED', 'COMPLETED', 'CANCELLED']) assert.equal(canAcceptCourseTransfer({ ...offer, status }, now - 1), false);
});

test('money distinguishes missing amounts from zero and never silently rounds 19-digit VND', () => {
  for (const value of [null, undefined, '', true, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatCourseMoney(value), '—');
  assert.match(formatCourseMoney(0), /^0/);
  assert.match(formatCourseMoney('9999999999999999999'), /^9\.999\.999\.999\.999\.999\.999/);
  assert.match(formatCourseMoney('-10000'), /-10\.000/);
  assert.equal(courseAmountText(0), '0');
  assert.equal(courseAmountText('9999999999999999999'), '9999999999999999999');
  assert.equal(courseAmountText(Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(courseAmountText(null), null);
});

test('course dates always use Vietnam time independently of the browser timezone', () => {
  assert.match(formatCourseDateTime('2026-11-01T18:00:00Z'), /2\/11\/26/);
  assert.match(formatCourseDateTime('2026-11-01T18:00:00Z'), /01:00/);
});

test('cancelled makeup sessions are identified from replacement links', () => {
  const sessions = [{ id: 'original', replacementSessionId: 'makeup' }, { id: 'makeup', status: 'CANCELLED_PENDING_MAKEUP', replacementSessionId: null }];
  assert.equal(courseMakeupIds(sessions).has('makeup'), true);
  assert.equal(courseMakeupIds(sessions).has('original'), false);
});

test('financial verification requires explicit evidence and preserves exact integer inputs', () => {
  const value = { reason: ' Đã đối chiếu ', amountVnd: '9999999999999999999', disbursementReference: ' TX-1 ', evidenceReference: ' RECEIPT-1 ' };
  const parsed = courseVerificationSchema.parse(value);
  assert.equal(parsed.amountVnd, value.amountVnd);
  assert.equal(parsed.reason, 'Đã đối chiếu');
  for (const amountVnd of ['', '-1', '1.5', '1e3', '10000000000000000000']) assert.equal(courseVerificationSchema.safeParse({ ...value, amountVnd }).success, false);
  assert.equal(courseVerificationSchema.safeParse({ ...value, evidenceReference: ' ' }).success, false);
  assert.equal(courseDecisionSchema.safeParse({ reason: ' ' }).success, false);
  assert.equal(courseDecisionSchema.safeParse({ reason: 'a'.repeat(1001) }).success, false);
  assert.equal(courseTransferDecisionSchema.safeParse({ reason: 'Đổi lịch', targetRunId: '' }).success, false);
});

test('notifications route by role and target type without treating offer IDs as request IDs', () => {
  const refund = { notificationType: 'COURSE_REFUND_VERIFICATION_READY', targetType: 'COURSE_REFUND_OBLIGATION', targetId: 'refund-id' };
  assert.equal(courseNotificationDestination(refund, 'manager'), '/manager/course-refunds?id=refund-id');
  assert.equal(courseNotificationDestination(refund, 'member'), '/member/courses#refunds');
  assert.equal(courseNotificationDestination(refund, 'reception'), '/reception/course-refunds');
  assert.equal(courseNotificationDestination({ notificationType: 'COURSE_TRANSFER_COMPLETED', targetType: 'COURSE_TRANSFER_OFFER', targetId: 'offer-id' }, 'manager'), '/manager/course-transfers');
  assert.equal(courseNotificationDestination({ notificationType: 'COURSE_TRANSFER_REQUESTED', targetType: 'COURSE_TRANSFER_REQUEST', targetId: 'a&b' }, 'manager'), '/manager/course-transfers?id=a%26b');
  assert.equal(courseNotificationDestination({ notificationType: 'MEMBERSHIP_REFUND_APPROVED' }, 'manager'), null);
});

test('new financial conflicts surface actionable Vietnamese text without internal details', () => {
  assert.match(getCourseErrorMessage({ response: { data: { code: 'COURSE_REFUND_CHANGED', detail: 'secret-id' } } }), /Tải lại hồ sơ/);
  assert.match(getCourseErrorMessage({ response: { data: { code: 'COURSE_REFUND_EVIDENCE_MISMATCH' } } }), /không khớp/);
  assert.match(getCourseErrorMessage({ response: { data: { code: 'COURSE_TRANSFER_OFFER_EXPIRED' } } }), /hết hạn/);
});
