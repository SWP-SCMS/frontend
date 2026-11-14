import api from './api';
import { courseIdempotencyConfig } from './courseServiceUtils';

export async function listCourseWithdrawals() {
  const { data } = await api.get('/manager/course-withdrawal-requests');
  return data;
}

export async function getCourseWithdrawal(id) {
  const { data } = await api.get(`/manager/course-withdrawal-requests/${id}`);
  return data;
}

export async function decideCourseWithdrawal(id, action, reason) {
  if (!['approve', 'reject'].includes(action)) throw new TypeError('Invalid withdrawal action');
  const { data } = await api.post(`/manager/course-withdrawal-requests/${id}/${action}`, { reason });
  return data;
}

export async function listCourseRefunds({ page = 0, size = 20, status } = {}) {
  const { data } = await api.get('/manager/course-refund-obligations', { params: { page, size, status: status || undefined } });
  return data;
}

export async function getCourseRefund(id) {
  const { data } = await api.get(`/manager/course-refund-obligations/${id}`);
  return data;
}

export async function decideCourseRefund(id, action, payload) {
  if (!['approve', 'reject', 'verify', 'fail', 'return'].includes(action)) throw new TypeError('Invalid refund action');
  const { data } = await api.post(`/manager/course-refund-obligations/${id}/${action}`, payload);
  return data;
}

export async function listReceptionCourseRefunds({ page = 0, eligible } = {}) {
  const { data } = await api.get('/reception/course-refunds', { params: { page, size: 20, eligible } });
  return data;
}

export async function getReceptionCourseRefund(id) {
  const { data } = await api.get(`/reception/course-refunds/${id}`);
  return data;
}

export async function disburseCourseRefund(id, payload, key) {
  const { data } = await api.post(`/reception/course-refund-obligations/${id}/disburse`, payload, courseIdempotencyConfig(key));
  return data;
}

export async function listReceptionCourseEnrollments(memberId, page = 0) { return (await api.get(`/reception/members/${memberId}/course-enrollments`, { params: { page, size: 20 } })).data; }
export async function requestReceptionCourseWithdrawal(memberId, enrollmentId, reason) { return (await api.post(`/reception/members/${memberId}/course-enrollments/${enrollmentId}/withdrawal-requests`, { reason })).data; }
