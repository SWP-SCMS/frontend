import api from './api';

export async function createCoachLeaveRequest(payload) {
  const { data } = await api.post('/coach/leave-requests', payload);
  return data;
}

export async function listMyCoachLeaveRequests() {
  const { data } = await api.get('/coach/me/leave-requests');
  return data;
}

export async function withdrawCoachLeaveRequest(requestId) {
  const { data } = await api.delete(
    `/coach/leave-requests/${encodeURIComponent(requestId)}`,
  );
  return data;
}

export async function listManagerCoachLeaveRequests(status) {
  const params = status ? { status } : undefined;
  const { data } = await api.get('/manager/coach-leave-requests', { params });
  return data;
}

export async function reviewCoachLeaveRequest(requestId, action, note) {
  const { data } = await api.patch(
    `/manager/coach-leave-requests/${encodeURIComponent(requestId)}/${action}`,
    { note: note?.trim() || null },
  );
  return data;
}
