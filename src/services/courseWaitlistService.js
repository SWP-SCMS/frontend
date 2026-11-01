import api from './api';
import { courseIdempotencyConfig } from './courseServiceUtils';

export async function listMyCourseWaitlists() {
  const { data } = await api.get('/members/me/course-waitlists');
  return Array.isArray(data) ? data : [];
}

export async function joinCourseWaitlist(runId) {
  const { data } = await api.post(`/course-runs/${runId}/waitlist`);
  return data;
}

export async function leaveCourseWaitlist(runId) {
  const { data } = await api.delete(`/course-runs/${runId}/waitlist`);
  return data;
}

export async function acceptCourseWaitlistInvitation(
  waitlistId,
  idempotencyKey,
) {
  const { data } = await api.post(
    `/course-waitlists/${waitlistId}/accept`,
    undefined,
    courseIdempotencyConfig(idempotencyKey),
  );
  return data;
}
