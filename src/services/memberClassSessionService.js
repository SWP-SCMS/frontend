// Member-scoped Class Schedule API (US32 — Member View Class Schedule).
//
// Endpoints (bearer-auth, MEMBER-only — backend enforces BR-SEC-04
// via SecurityConfiguration.requestMatchers(GET, "/members/class-sessions")
// .hasRole("MEMBER") and ClassSessionService.memberSchedule's
// accounts.existsByIdAndRoleAndStatus(memberId, MEMBER, ACTIVE) check):
//   GET /api/v1/members/class-sessions   listMemberClassSessions  (US32)
//
// US32 is READ-ONLY. There is intentionally no POST / PATCH / DELETE
// exported here — booking, cancel, and edits belong to other stories.
//
// Accepted query params (all optional, all server-validated):
//   from    ISO Instant string (UTC, e.g. "...Z")
//           BE filter: endTime > from (strict greater).
//   to      ISO Instant string (UTC, e.g. "...Z")
//           BE filter: startTime < to (strict less). Combined with
//           `from`, the visible interval is the open range
//           endTime > from AND startTime < to. The BE rejects
//           (400 VALIDATION_ERROR on `to`) when both ends are set
//           and to <= from.
//   classId UUID string (exact match). Not surfaced in the US32 UI
//           because the Member endpoint does not expose a catalogue
//           GET to feed a class dropdown, but the service still
//           accepts it for completeness / future reuse.
//   page    int (default 0 server-side).
//   size    int (default 20 server-side; BE-enforced 1..100).
//
// Returns: MemberClassSessionPageResponse
//   {
//     content: MemberClassSessionResponse[],
//     page, size, totalElements, totalPages
//   }
//
// MemberClassSessionResponse (verified wire):
//   id, classId, className, classType, disciplineId, disciplineName,
//   coachId, coachName, roomId, roomName, startTime, endTime,
//   capacity, bookedCount, availableCapacity, status, bookingAvailable
//
// Notes:
//   - status is always SCHEDULED on this endpoint (the BE predicates
//     hard-code status==SCHEDULED AND startTime>now).
//   - availableCapacity is authoritative:
//       max(0, capacity - count(BOOKED bookings))
//     CANCELLED bookings are NOT counted. The FE MUST display this
//     field verbatim; recomputing "capacity - bookedCount" on the FE
//     risks divergence under concurrent bookings.
//   - coachName / roomName / className / disciplineName are
//     server-resolved, so US32 issues zero N+1 lookup calls.

import api from './api';

// GET /api/v1/members/class-sessions (US32)
export async function listMemberClassSessions(params = {}) {
  const cleaned = {};
  // Drop undefined / null / empty-string optional values without
  // touching numeric `page = 0` (which is a meaningful default).
  // Order chosen to match the BE's parameter list for grep-ability.
  if (params.from != null && params.from !== '') cleaned.from = params.from;
  if (params.to != null && params.to !== '') cleaned.to = params.to;
  if (params.classId) cleaned.classId = params.classId;
  if (params.page != null) cleaned.page = params.page;
  if (params.size != null) cleaned.size = params.size;
  const { data } = await api.get('/members/class-sessions', {
    params: cleaned,
  });
  return data;
}
