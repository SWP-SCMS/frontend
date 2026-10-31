import api from './api';

export async function listMyCourseWithdrawals() {
  const { data } = await api.get('/members/me/course-withdrawal-requests');
  return Array.isArray(data) ? data : [];
}

export async function createMyCourseWithdrawal(enrollmentId, reason) {
  const { data } = await api.post(
    `/members/me/course-enrollments/${enrollmentId}/withdrawal-requests`,
    { reason },
  );
  return data;
}
