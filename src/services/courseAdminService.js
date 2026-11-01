import api from './api';
import { normalizeCoursePage } from './courseServiceUtils';

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

export async function cancelManagerCourseRun(runId, expectedVersion) {
  const { data } = await api.post(`/manager/course-runs/${runId}/cancel`, {
    expectedVersion,
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
export async function listCourseApprovals(page = 0) { return (await api.get('/manager/course-approval-requests', { params: { page, size: 20 } })).data; }
export async function decideCourseApproval(id, action, payload) {
  if (!['approve', 'reject'].includes(action)) throw new TypeError('Invalid approval action');
  return (await api.post(`/manager/course-approval-requests/${id}/${action}`, payload)).data;
}
