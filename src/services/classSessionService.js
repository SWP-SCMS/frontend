// Manager-scoped Single Class Session API (US27).
//
// Endpoint (bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   POST /api/v1/manager/class-sessions              createSingleSession
//
// Notes:
//   - The BE creates exactly one ClassSession row inside a single
//     @Transactional method (ClassSessionService.create). There is
//     no recurring-schedule link; the FE MUST NOT send a
//     recurringScheduleId field — the BE always sets it to null for
//     sessions created by this endpoint.
//   - The request body carries the full ISO-8601 Instant values
//     for startTime / endTime (BE compares them against
//     Asia/Ho_Chi_Minh via RecurringScheduleService.GYM_ZONE).
//     The FE converts the manager's local Asia/Ho_Chi_Minh
//     date + HH:mm selection into an Instant before submitting.
//   - The FE does NOT pre-compute occurrences; it sends one request
//     and renders the BE's response.
//   - There is no list / detail / update / delete endpoint for
//     single sessions in US27. The FE is creation-only here.

import api from './api';

// POST /api/v1/manager/class-sessions
//
// Expected payload (server-enforced):
//   {
//     classId,     // UUID — from the class-scoped route
//     coachId,     // UUID — selected COACH
//     roomId,      // UUID — selected ACTIVE Room
//     startTime,   // ISO-8601 Instant (Asia/Ho_Chi_Mnh wall-clock)
//     endTime,     // ISO-8601 Instant (Asia/Ho_Chi_Mnh wall-clock, > startTime)
//     capacity,    // positive integer (<= room.capacity)
//   }
//
// Returns: ClassSessionResponse
//   { id, classId, coachId, roomId, startTime, endTime, capacity, status }
export async function createSingleSession(payload) {
  const { data } = await api.post('/manager/class-sessions', payload);
  return data;
}
