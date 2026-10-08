// Manager-scoped Room API (US25).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces via
// SecurityConfiguration.requestMatchers("/manager/rooms", "/manager/rooms/**").hasRole("MANAGER")):
//   GET    /api/v1/manager/rooms                  listRooms
//   POST   /api/v1/manager/rooms                  createRoom
//   GET    /api/v1/manager/rooms/{roomId}         getRoom
//   PATCH  /api/v1/manager/rooms/{roomId}         updateRoom
//
// Notes:
//   - List returns a plain array; server sort is fixed (name ASC, id ASC).
//   - No pagination, no search/filter query params — those are FE-only today.
//   - Create body shape: { name, capacity }. name is trimmed server-side;
//     capacity must be a positive integer. status is NOT accepted on
//     create (new rooms are always ACTIVE server-side).
//   - PATCH body shape: subset of { name, capacity, status }. At least one
//     field MUST be present (else 400 VALIDATION_ERROR, field=request).
//   - There is NO delete endpoint — to retire, PATCH { status: 'INACTIVE' }.

import api from './api';

// GET /api/v1/manager/rooms
export async function listRooms() {
  const { data } = await api.get('/manager/rooms');
  return Array.isArray(data) ? data : [];
}

// POST /api/v1/manager/rooms
export async function createRoom(payload) {
  const { data } = await api.post('/manager/rooms', payload);
  return data;
}

// GET /api/v1/manager/rooms/{roomId}
export async function getRoom(roomId) {
  const { data } = await api.get(`/manager/rooms/${roomId}`);
  return data;
}

// PATCH /api/v1/manager/rooms/{roomId}
export async function updateRoom(roomId, patch) {
  const { data } = await api.patch(`/manager/rooms/${roomId}`, patch);
  return data;
}
