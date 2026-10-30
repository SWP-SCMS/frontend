import api from './api';

export async function listMyCourseEnrollments() {
  const { data } = await api.get('/members/me/course-enrollments');
  return Array.isArray(data) ? data : [];
}
