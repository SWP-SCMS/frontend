// Manager-scoped Member account API calls (US06).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   GET    /api/v1/manager/members            searchMemberAccounts
//   GET    /api/v1/manager/members/{id}       getMemberAccount
//   PATCH  /api/v1/manager/members/{id}       updateMemberAccount
//   PATCH  /api/v1/manager/members/{id}/status  changeMemberAccountStatus
//
// Notes:
//   - PATCH rejects unknown fields on the backend (`rejectUnknownField`),
//     so we only ever send the four permitted keys (fullName, phone,
//     email, birthDate). Role is intentionally NOT patchable per BR-ACC-05.
//   - The list filter `status` accepts ACTIVE | INACTIVE | SUSPENDED
//     (Members can be all three; staff only ever ACTIVE|INACTIVE).

import api from './api';

// GET /api/v1/manager/members
export async function searchMemberAccounts({
  query,
  status,
  page = 0,
  size = 20,
} = {}) {
  const params = {};
  if (query && query.trim()) params.query = query.trim();
  if (status) params.status = status;
  params.page = page;
  params.size = size;

  const { data } = await api.get('/manager/members', { params });
  return data;
}

// GET /api/v1/manager/members/{memberAccountId}
export async function getMemberAccount(memberAccountId) {
  const { data } = await api.get(`/manager/members/${memberAccountId}`);
  return data;
}

// PATCH /api/v1/manager/members/{memberAccountId}
// `patch` is an object whose keys must be a subset of:
// { fullName, phone, email, birthDate }. Anything else triggers a 400
// from the backend (`rejectUnknownField`).
export async function updateMemberAccount(memberAccountId, patch) {
  const { data } = await api.patch(`/manager/members/${memberAccountId}`, patch);
  return data;
}

// PATCH /api/v1/manager/members/{memberAccountId}/status
// Per BR-ACC-19 only ACTIVE | SUSPENDED is settable for Members.
export async function changeMemberAccountStatus(memberAccountId, payload) {
  const { data } = await api.patch(
    `/manager/members/${memberAccountId}/status`,
    payload,
  );
  return data;
}