// Public membership offer browsing. The handoff prefers these as public,
// read-only endpoints that only expose ACTIVE offers.

import api from './api';

// GET /api/v1/membership-offers?planCode=BASIC|PLUS
// planCode is optional; backend returns [] when nothing matches.
// NOTE: the backend allows this endpoint for MEMBER *or* RECEPTIONIST
// (us12 contract), so Receptionist pages reuse this function rather than
// declaring a duplicate in receptionistService.js.
export async function listActiveOffers({ planCode } = {}) {
  const { data } = await api.get('/membership-offers', {
    params: planCode ? { planCode } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

// GET /api/v1/membership-offers/{offerId}
export async function getOfferById(offerId) {
  const { data } = await api.get(`/membership-offers/${offerId}`);
  return data;
}

// GET /api/v1/members/me/memberships — lịch sử Membership của chính Member
// (mới nhất trước). Mỗi phần tử có `status` là ACTIVE hoặc EXPIRED.
// Lưu ý: BE trả tên cột dạng snake_case (plan_code_snapshot, starts_at, ends_at...).
export async function getMyMemberships() {
  const { data } = await api.get('/members/me/memberships');
  return Array.isArray(data) ? data : [];
}
