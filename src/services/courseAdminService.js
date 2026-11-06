import api from './api';
import { API_BASE_URL } from '../constants';
import { normalizeCoursePage, courseIdempotencyConfig } from './courseServiceUtils';

export async function listManagerCourses({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/manager/courses', {
    params: { page, size },
  });
  return normalizeCoursePage(data);
}

export async function createManagerCourse(payload) {
  const { data } = await api.post('/manager/courses', payload);
  return data;
}

export async function getManagerCourse(courseId) {
  const { data } = await api.get(`/manager/courses/${courseId}`);
  return data;
}

export async function updateManagerCourse(courseId, payload) {
  const { data } = await api.patch(`/manager/courses/${courseId}`, payload);
  return data;
}

export async function publishManagerCourse(courseId, expectedVersion) {
  const { data } = await api.post(`/manager/courses/${courseId}/publish`, {
    expectedVersion,
  });
  return data;
}

export async function deactivateManagerCourse(courseId, expectedVersion) {
  const { data } = await api.post(`/manager/courses/${courseId}/deactivate`, {
    expectedVersion,
  });
  return data;
}

export async function archiveManagerCourse(courseId, expectedVersion) {
  const { data } = await api.post(`/manager/courses/${courseId}/archive`, {
    expectedVersion,
  });
  return data;
}

export async function listManagerCourseRuns({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/manager/course-runs', {
    params: { page, size },
  });
  return normalizeCoursePage(data);
}

export async function createManagerCourseRun(payload) {
  const { data } = await api.post('/manager/course-runs', payload);
  return data;
}

export async function getManagerCourseRun(runId) {
  const { data } = await api.get(`/manager/course-runs/${runId}`);
  return data;
}

export async function updateManagerCourseRun(runId, payload) {
  const { data } = await api.patch(`/manager/course-runs/${runId}`, payload);
  return data;
}

export async function openManagerCourseRunRegistration(
  runId,
  expectedVersion,
  policyVersion,
) {
  const { data } = await api.post(
    `/manager/course-runs/${runId}/open-registration`,
    { expectedVersion, policyVersion },
  );
  return data;
}

export async function getCourseCancellationImpact(runId) {
  return (await api.get(`/manager/course-runs/${runId}/cancellation-impact`)).data;
}

export async function cancelManagerCourseRun(runId, expectedVersion, reason) {
  const { data } = await api.post(`/manager/course-runs/${runId}/cancel`, {
    expectedVersion,
    reason,
  });
  return data;
}

export async function listManagerCourseSessions(runId) {
  const { data } = await api.get(`/manager/course-runs/${runId}/sessions`);
  return Array.isArray(data) ? data : [];
}

export async function createManagerCourseSession(runId, payload) {
  const { data } = await api.post(
    `/manager/course-runs/${runId}/sessions`,
    payload,
  );
  return data;
}

export async function getManagerCourseSession(runId, sessionId) {
  const { data } = await api.get(
    `/manager/course-runs/${runId}/sessions/${sessionId}`,
  );
  return data;
}

export async function updateManagerCourseSession(runId, sessionId, payload) {
  const { data } = await api.patch(
    `/manager/course-runs/${runId}/sessions/${sessionId}`,
    payload,
  );
  return data;
}

export async function cancelManagerCourseSession(runId, sessionId, expectedVersion) {
  const { data } = await api.post(`/manager/course-runs/${runId}/sessions/${sessionId}/cancel`, { expectedVersion });
  return data;
}

export async function createManagerCourseMakeup(runId, sessionId, payload) {
  const { data } = await api.post(`/manager/course-runs/${runId}/sessions/${sessionId}/makeup`, payload);
  return data;
}

export async function updateCourseRunSchedule(id, payload) { return (await api.patch(`/manager/course-runs/${id}/schedule`, payload)).data; }
export async function cancelCourseSessionWithMakeup(runId, sessionId, payload) { return (await api.post(`/manager/course-runs/${runId}/sessions/${sessionId}/cancel-with-makeup`, payload)).data; }

export async function rescheduleCourseRun(id, payload, key) { return (await api.post(`/manager/course-runs/${id}/reschedule`, payload, courseIdempotencyConfig(key))).data; }

export async function uploadCourseImage(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/manager/courses/images', body);
  return `${API_BASE_URL.replace(/\/$/, '')}${data.imageUrl}`;
}

export async function previewCourseWeeklySchedule(schedule, signal) {
  const { data } = await api.post('/manager/course-runs/preview-schedule', schedule, { signal });
  return data;
}

export async function createWeeklyCourseRun(payload) {
  const { data } = await api.post('/manager/course-runs/with-schedule', payload);
  return data;
}
