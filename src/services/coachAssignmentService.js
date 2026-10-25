import api from './api';

export const ASSIGNMENT_CANDIDATE_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  ALL: 'ALL',
};

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

export async function getCoachAssignmentImpact(memberAccountId) {
  const { data } = await api.get(
    `/manager/members/${encodeURIComponent(memberAccountId)}/coach-assignment/impact`,
  );
  return data;
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

// Manager discovery queue. The backend already limits this result to ACTIVE
// Members whose ACTIVE Membership contains PERSONAL_COACHING.
export async function listCoachAssignmentCandidates({
  query,
  assignmentStatus = ASSIGNMENT_CANDIDATE_STATUS.UNASSIGNED,
  page = 0,
  size = 20,
} = {}) {
  const params = { assignmentStatus, page, size };
  if (query && query.trim()) params.query = query.trim();
  const { data } = await api.get('/manager/coach-assignments/candidates', {
    params,
  });
  return data;
}

// Capacity is enforced by the backend during assign/reassign. The response is
// used for early UI feedback only; a concurrent mutation can still be rejected.
export async function listCoachAssignmentWorkloads() {
  const { data } = await api.get('/manager/coaches/assignment-workloads');
  return Array.isArray(data) ? data : [];
}
