import api from './api';
export async function listMyCourseRefunds(page = 0) {
  const { data } = await api.get('/members/me/course-refund-obligations', { params: { page, size: 20 } });
  return data;
}
export async function getCourseRunReport(filters = {}) {
  const { data } = await api.get('/manager/reports/course-runs', { params: { size: 20, ...filters } });
  return data;
}
