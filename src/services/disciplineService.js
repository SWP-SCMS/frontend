// Manager-scoped Discipline API (US23).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces via
// SecurityConfiguration.requestMatchers("/manager/disciplines", "/manager/disciplines/**").hasRole("MANAGER")):
//   GET    /api/v1/manager/disciplines                listDisciplines
//   POST   /api/v1/manager/disciplines                createDiscipline
//   GET    /api/v1/manager/disciplines/{id}           getDiscipline
//   PATCH  /api/v1/manager/disciplines/{id}           updateDiscipline
//
// Notes:
//   - List returns a plain array; server sort is fixed (name ASC, id ASC).
//   - No pagination, no search/filter query params — those are FE-only today.
//   - Create body shape: { name: string (1..150), description?: string|null }.
//   - PATCH body shape: subset of { name, description, status } where status ∈
//     { 'ACTIVE', 'INACTIVE' }. At least one field MUST be present (else 400).
//   - There is NO delete endpoint — to retire, PATCH { status: 'INACTIVE' }.

import api from './api';

// GET /api/v1/manager/disciplines
export async function listDisciplines() {
  const { data } = await api.get('/manager/disciplines');
  return Array.isArray(data) ? data : [];
}

// POST /api/v1/manager/disciplines
export async function createDiscipline(payload) {
  const { data } = await api.post('/manager/disciplines', payload);
  return data;
}

// GET /api/v1/manager/disciplines/{disciplineId}
export async function getDiscipline(disciplineId) {
  const { data } = await api.get(`/manager/disciplines/${disciplineId}`);
  return data;
}

// PATCH /api/v1/manager/disciplines/{disciplineId}
export async function updateDiscipline(disciplineId, patch) {
  const { data } = await api.patch(
    `/manager/disciplines/${disciplineId}`,
    patch,
  );
  return data;
}