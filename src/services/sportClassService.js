// Manager-scoped SportClass API (US24).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces via
// SecurityConfiguration.requestMatchers("/manager/classes", "/manager/classes/**").hasRole("MANAGER")):
//   GET    /api/v1/manager/classes                       listClasses
//   POST   /api/v1/manager/classes                       createClass
//   GET    /api/v1/manager/classes/{classId}             getClass
//   PATCH  /api/v1/manager/classes/{classId}             updateClass
//
// Notes:
//   - List returns a plain array; server sort is fixed (name ASC, id ASC).
//   - No pagination, no search/filter query params — those are FE-only today.
//   - Create body shape: { disciplineId, name, classType, description? }.
//     classType ∈ { 'GROUP', 'YOGA', 'PT_1_1' }. status is NOT accepted on
//     create (new classes are always ACTIVE server-side).
//   - PATCH body shape: subset of { name, classType, description, status }.
//     At least one field MUST be present (else 400). disciplineId is
//     immutable after create; the BE rejects any attempt to alter it.
//   - There is NO delete endpoint — to retire, PATCH { status: 'INACTIVE' }.

import api from './api';

// GET /api/v1/manager/classes
export async function listClasses() {
  const { data } = await api.get('/manager/classes');
  return Array.isArray(data) ? data : [];
}

// POST /api/v1/manager/classes
export async function createClass(payload) {
  const { data } = await api.post('/manager/classes', payload);
  return data;
}

// GET /api/v1/manager/classes/{classId}
export async function getClass(classId) {
  const { data } = await api.get(`/manager/classes/${classId}`);
  return data;
}

// PATCH /api/v1/manager/classes/{classId}
export async function updateClass(classId, patch) {
  const { data } = await api.patch(`/manager/classes/${classId}`, patch);
  return data;
}