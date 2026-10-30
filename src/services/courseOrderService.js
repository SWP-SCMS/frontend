import api from './api';
import { courseIdempotencyConfig } from './courseServiceUtils';

export async function createMyCourseOrder(courseRunId, idempotencyKey) {
  const { data } = await api.post(
    '/members/me/course-orders',
    { courseRunId },
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}

export async function getMyCourseOrder(orderId) {
  const { data } = await api.get(`/members/me/course-orders/${orderId}`);
  return data;
}

export async function createReceptionCourseOrder(
  memberId,
  courseRunId,
  idempotencyKey,
) {
  const { data } = await api.post(
    `/reception/members/${memberId}/course-orders`,
    { courseRunId },
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}

export async function getReceptionCourseOrder(memberId, orderId) {
  const { data } = await api.get(
    `/reception/members/${memberId}/course-orders/${orderId}`,
  );
  return data;
}

export async function startMyCourseSepayPayment(orderId, idempotencyKey) {
  const { data } = await api.post(
    `/members/me/course-orders/${orderId}/payments/sepay`,
    undefined,
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}

export async function startReceptionCourseSepayPayment(
  memberId,
  orderId,
  idempotencyKey,
) {
  const { data } = await api.post(
    `/reception/members/${memberId}/course-orders/${orderId}/payments/sepay`,
    undefined,
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}

export async function confirmReceptionCourseCashPayment(
  memberId,
  orderId,
  idempotencyKey,
) {
  const { data } = await api.post(
    `/reception/members/${memberId}/course-orders/${orderId}/payments/cash`,
    undefined,
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}
