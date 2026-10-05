// Manager-scoped staff/manager account API calls (US05-08).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   GET    /api/v1/manager/staff-accounts            searchStaffAccounts
//   POST   /api/v1/manager/staff-accounts            createStaffAccount
//   GET    /api/v1/manager/staff-accounts/{id}       getStaffAccount
//   PATCH  /api/v1/manager/staff-accounts/{id}       updateStaffAccount
//   PATCH  /api/v1/manager/staff-accounts/{id}/status  changeStaffAccountStatus
//   POST   /api/v1/manager/staff-accounts/{id}/reset-password  resetStaffAccountPassword
//
// Notes:
//   - PATCH rejects unknown fields on the backend (`rejectUnknownField`),
//     so we only ever send the four permitted keys (fullName, phone,
//     email, birthDate). Role is intentionally NOT patchable per BR-ACC-05.
//   - The list filter `status` only accepts ACTIVE | INACTIVE (US05 spec).
//   - `role` filter accepts COACH | RECEPTIONIST | MANAGER (no MEMBER).

import api from './api';

// GET /api/v1/manager/staff-accounts
export async function searchStaffAccounts({
  query,
  role,
  status,
  page = 0,
  size = 20,
} = {}) {
  const params = {};
  if (query && query.trim()) params.query = query.trim();
  if (role) params.role = role;
  if (status) params.status = status;
  params.page = page;
  params.size = size;

  const { data } = await api.get('/manager/staff-accounts', { params });
  return data;
}

// POST /api/v1/manager/staff-accounts
export async function createStaffAccount(payload) {
  const { data } = await api.post('/manager/staff-accounts', payload);
  return data;
}

// GET /api/v1/manager/staff-accounts/{accountId}
export async function getStaffAccount(accountId) {
  const { data } = await api.get(`/manager/staff-accounts/${accountId}`);
  return data;
}

// PATCH /api/v1/manager/staff-accounts/{accountId}
// `patch` is an object whose keys must be a subset of:
// { fullName, phone, email, birthDate }. Anything else triggers a 400
// from the backend (`rejectUnknownField`).
export async function updateStaffAccount(accountId, patch) {
  const { data } = await api.patch(`/manager/staff-accounts/${accountId}`, patch);
  return data;
}

// PATCH /api/v1/manager/staff-accounts/{accountId}/status
// Per BR-ACC-19 only INACTIVE is settable for staff/manager. The backend
// service is currently a `deactivate` flow, but we still send the
// requested status + reason as documented in the DTO.
export async function changeStaffAccountStatus(accountId, payload) {
  const { data } = await api.patch(
    `/manager/staff-accounts/${accountId}/status`,
    payload,
  );
  return data;
}

// POST /api/v1/manager/staff-accounts/{accountId}/reset-password
// 204 No Content. Caller should not expect a body.
export async function resetStaffAccountPassword(accountId) {
  await api.post(`/manager/staff-accounts/${accountId}/reset-password`);
}