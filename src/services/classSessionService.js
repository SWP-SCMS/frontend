// Manager-scoped Class Session API (US27 + US28 + US29 + US30).
//
// Endpoints (bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   POST /api/v1/manager/class-sessions              createSingleSession       (US27)
//   GET  /api/v1/manager/class-sessions              listManagerSessions      (US28)
//   GET  /api/v1/manager/class-sessions/{id}         getManagerSessionDetail  (US29)
//   PATCH /api/v1/manager/class-sessions/{id}/assignment
//                                                      updateSessionAssignment  (US30)
//
// Notes:
//   - The list endpoint returns a ClassSessionPageResponse:
//       { content, page, size, totalElements, totalPages }
//     where each item is a ClassSessionResponse:
//       { id, classId, coachId, roomId, startTime, endTime,
//         capacity, status }
//   - The wire contains ONLY IDs for Class / Coach / Room (verified
//     from the BE's ClassSessionResponse.from() factory). Names are
//     resolved client-side via listClasses / listRooms /
//     searchStaffAccounts.
//   - US28 is read-only. There is no Session detail page in US28.

import api from './api';

// POST /api/v1/manager/class-sessions (US27 — unchanged)
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

// GET /api/v1/manager/class-sessions (US28)
//
// Accepted query params (all optional):
//   from, to              ISO-8601 Instant strings (UTC, e.g. "...Z")
//                         BE filters: endTime > from AND startTime < to
//                         (open interval [from, to) over the Session interval).
//   classId, coachId, roomId   UUID strings (exact match)
//   status                ClassSessionStatus wire value
//                         ('SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED')
//   page                  int (default 0 server-side)
//   size                  int (default 20 server-side; BE caps 1..100)
//
// Returns: ClassSessionPageResponse
//   { content: ClassSessionResponse[], page, size, totalElements, totalPages }
export async function listManagerSessions(params = {}) {
  const cleaned = {};
  if (params.from) cleaned.from = params.from;
  if (params.to) cleaned.to = params.to;
  if (params.classId) cleaned.classId = params.classId;
  if (params.coachId) cleaned.coachId = params.coachId;
  if (params.roomId) cleaned.roomId = params.roomId;
  if (params.status) cleaned.status = params.status;
  if (params.page != null) cleaned.page = params.page;
  if (params.size != null) cleaned.size = params.size;
  const { data } = await api.get('/manager/class-sessions', {
    params: cleaned,
  });
  return data;
}

// GET /api/v1/manager/class-sessions/{id} (US29)
//
// Path param:
//   id  UUID string from the route /manager/class-sessions/:sessionId
//
// Returns: ClassSessionDetailResponse — labels are server-resolved
// (className, disciplineName, coachName, roomName), so the FE does not
// need to call listClasses / listRooms / searchStaffAccounts. The FE
// also does not render bookedCount because the verified detail DTO
// does not include it.
export async function getManagerSessionDetail(id) {
  if (!id) throw new Error('id is required');
  const { data } = await api.get(
    `/manager/class-sessions/${encodeURIComponent(id)}`,
  );
  return data;
}

// PATCH /api/v1/manager/class-sessions/{id}/assignment (US30)
//
// Path param:
//   id  UUID string from the route /manager/class-sessions/:sessionId/assignment/edit
//
// Expected payload (verified, server-enforced — partial PATCH is
// supported, omit an unchanged key):
//   {
//     coachId?,   // UUID — optional, omit to keep current
//     roomId?,    // UUID — optional, omit to keep current
//   }
// At least one of coachId / roomId MUST be present (the BE returns
// 400 VALIDATION_ERROR with errors.request otherwise). The FE never
// sends an empty body — the page-level no-change guard short-circuits
// before this service is called.
//
// Success status: 200 OK
// Returns: ClassSessionDetailResponse — same shape US29 consumes.
export async function updateSessionAssignment(sessionId, patch) {
  if (!sessionId) throw new Error('sessionId is required');
  if (!patch || typeof patch !== 'object') {
    throw new Error('patch object is required');
  }
  const { data } = await api.patch(
    `/manager/class-sessions/${encodeURIComponent(sessionId)}/assignment`,
    patch,
  );
  return data;
}
