// Receptionist-scoped Booking APIs (US35).
//
// IMPORTANT: `memberAccountId` is the Member account UUID returned by the
// Receptionist profile API. It is not the public MB-* Member code used in
// Receptionist-facing routes.

import api from './api';

export async function listReceptionMemberBookings(
  memberAccountId,
  { status, page, size } = {},
) {
  const params = {};
  if (status) params.status = status;
  if (page != null) params.page = page;
  if (size != null) params.size = size;

  const { data } = await api.get(
    `/reception/members/${memberAccountId}/bookings`,
    { params },
  );
  return data;
}

export async function listReceptionClassSessions({
  from,
  to,
  classId,
  page,
  size,
} = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (classId) params.classId = classId;
  if (page != null) params.page = page;
  if (size != null) params.size = size;

  const { data } = await api.get('/reception/class-sessions', { params });
  return data;
}

export async function createReceptionMemberBooking(
  memberAccountId,
  { sessionId },
) {
  const { data } = await api.post(
    `/reception/members/${memberAccountId}/bookings`,
    { sessionId },
  );
  return data;
}

export async function cancelReceptionMemberBooking(
  memberAccountId,
  bookingId,
) {
  const { data } = await api.patch(
    `/reception/members/${memberAccountId}/bookings/${bookingId}/cancel`,
  );
  return data;
}
