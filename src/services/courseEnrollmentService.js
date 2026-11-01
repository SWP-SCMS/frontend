import api from './api';

export async function listMyCourseEnrollments() {
  const { data } = await api.get('/members/me/course-enrollments');
  return Array.isArray(data) ? data : [];
}

export async function listMyCourseScheduleChanges() {
  const { data } = await api.get('/members/me/course-schedule-changes');
  return Array.isArray(data) ? data : [];
}

export async function respondToCourseScheduleChange(responseId, response) {
  const { data } = await api.post(`/members/me/course-schedule-changes/${responseId}/response`, { response });
  return data;
}
