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

export async function listManagerCoachLeaveRequests(status, page = 0) {
  const params = { page, size: 20, ...(status ? { status } : {}) };
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

export async function getCoachLeaveImpact(requestId) {
  const { data } = await api.get(`/manager/coach-leave-requests/${encodeURIComponent(requestId)}/impact`);
  if (!data?.request || !Array.isArray(data.sessions)) throw new TypeError('Invalid leave impact response');
  return data;
}

export async function getLeaveReplacementCoaches(requestId, session) {
  const { data } = await api.get(`/manager/coach-leave-requests/${encodeURIComponent(requestId)}/affected-sessions/${session.type}/${encodeURIComponent(session.id)}/available-coaches`);
  return Array.isArray(data) ? data : [];
}

function batchSelection(sessions) {
  return sessions.map(session => ({ type: session.type, id: session.id, expectedVersion: session.version }));
}
export async function getLeaveBatchReplacementCoaches(requestId, sessions) {
  const { data } = await api.post(`/manager/coach-leave-requests/${encodeURIComponent(requestId)}/batch/available-coaches`, { sessions: batchSelection(sessions) });
  return Array.isArray(data) ? data : [];
}
export async function resolveLeaveBatch(requestId, sessions, action, coachId, reason) {
  const { data } = await api.post(`/manager/coach-leave-requests/${encodeURIComponent(requestId)}/batch`, {
    sessions: batchSelection(sessions), action, coachId: action === 'reassign' ? coachId : null,
    reason: action === 'cancel' ? reason.trim() : null,
  });
  return data;
}
