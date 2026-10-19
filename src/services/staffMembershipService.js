import api from './api';

// Staff membership-history endpoints intentionally use different identifier
// types. Keep the functions separate so callers cannot accidentally send a
// public MB-* code to the Manager endpoint or an account UUID to Reception.

export async function getManagerMemberMemberships(memberAccountId) {
  const { data } = await api.get(
    `/manager/members/${encodeURIComponent(memberAccountId)}/memberships`,
  );
  return Array.isArray(data) ? data : [];
}

export async function getReceptionMemberMemberships(memberCode) {
  const { data } = await api.get(
    `/reception/members/${encodeURIComponent(memberCode)}/memberships`,
  );
  return Array.isArray(data) ? data : [];
}
