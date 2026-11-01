import api from './api';

export async function getCourseSessionRoster(sessionId) {
  const { data } = await api.get(
    `/coach/course-sessions/${sessionId}/roster`,
  );
  return Array.isArray(data) ? data : [];
}

export async function updateCourseAttendance(
  sessionId,
  enrollmentSessionId,
  status,
) {
  const { data } = await api.patch(
    `/coach/course-sessions/${sessionId}/roster/${enrollmentSessionId}/attendance`,
    { status },
  );
  return data;
}
