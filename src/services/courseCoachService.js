import api from './api';
export async function listCoachCourseSessions(page = 0) { return (await api.get('/coach/course-sessions', { params: { page, size: 20 } })).data; }
export async function getCoachCourseSession(id) { return (await api.get(`/coach/course-sessions/${id}`)).data; }
export async function getCoachCourseRoster(id) { return (await api.get(`/coach/course-sessions/${id}/roster`)).data; }
export async function updateCourseAttendance(id, enrollmentId, status) { return (await api.patch(`/coach/course-sessions/${id}/roster/${enrollmentId}/attendance`, { status })).data; }
