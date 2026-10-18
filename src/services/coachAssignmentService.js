import api from './api';

export async function getMyActiveCoachAssignment() {
  const response = await api.get('/members/me/coach-assignment');
  return response.status === 204 ? null : response.data;
}

// Manager-only Coach assignment endpoints. `memberAccountId` is the Member
// account UUID used by the Manager Member routes, not the public MB-* code.
export async function getActiveCoachAssignment(memberAccountId) {
  const response = await api.get(
    `/manager/members/${encodeURIComponent(memberAccountId)}/coach-assignment`,
  );
  return response.status === 204 ? null : response.data;
}

export async function listCoachAssignmentHistory(
  memberAccountId,
  { page = 0, size = 10 } = {},
) {
  const { data } = await api.get(
    `/manager/members/${encodeURIComponent(memberAccountId)}/coach-assignments`,
    { params: { page, size } },
  );
  return data;
}

export async function assignCoach(memberAccountId, payload) {
  const { data } = await api.post(
    `/manager/members/${encodeURIComponent(memberAccountId)}/coach-assignment`,
    payload,
  );
  return data;
}

export async function endCoachAssignment(memberAccountId, payload) {
  const { data } = await api.patch(
    `/manager/members/${encodeURIComponent(memberAccountId)}/coach-assignment/end`,
    payload,
  );
  return data;
}
