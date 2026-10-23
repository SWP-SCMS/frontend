import api from './api';

export async function listMyWaitlists() {
  const { data } = await api.get('/members/me/waitlists');
  return Array.isArray(data) ? data : [];
}

export async function joinMyWaitlist(sessionId) {
  const { data } = await api.post(
    `/members/class-sessions/${sessionId}/waitlist`,
  );
  return data;
}

export async function leaveMyWaitlist(sessionId) {
  const { data } = await api.delete(
    `/members/class-sessions/${sessionId}/waitlist`,
  );
  return data;
}

export async function listReceptionSessionWaitlist(sessionId) {
  const { data } = await api.get(
    `/reception/class-sessions/${sessionId}/waitlist`,
  );
  return Array.isArray(data) ? data : [];
}

export async function joinReceptionMemberWaitlist(memberAccountId, sessionId) {
  const { data } = await api.post(
    `/reception/members/${memberAccountId}/class-sessions/${sessionId}/waitlist`,
  );
  return data;
}

export async function leaveReceptionMemberWaitlist(memberAccountId, sessionId) {
  const { data } = await api.delete(
    `/reception/members/${memberAccountId}/class-sessions/${sessionId}/waitlist`,
  );
  return data;
}

export async function listManagerSessionWaitlist(sessionId) {
  const { data } = await api.get(
    `/manager/class-sessions/${sessionId}/waitlist`,
  );
  return Array.isArray(data) ? data : [];
}
