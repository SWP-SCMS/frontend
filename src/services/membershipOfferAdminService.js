// Manager-scoped Membership Offer API (US08).
//
// Endpoints (all bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   GET    /api/v1/manager/membership-offers       listMembershipOffersAdmin
//   POST   /api/v1/manager/membership-offers       createMembershipOffer
//   PATCH  /api/v1/manager/membership-offers/{id}  updateMembershipOffer
//
// Notes:
//   - MembershipOfferResponse does NOT include `status` (only the public
//     surface does). The admin DTO accepts status, so when filtering by
//     status on the FE we currently cannot tell ACTIVE vs INACTIVE apart
//     from the response alone. We forward the intended status filter to
//     the BE? -> not implemented there, so FE filters client-side.
//   - Plan codes are BASIC | PLUS (per MembershipPlanCode enum).
//   - priceAmount is a BigInteger in VND; we send it as a number string
//     because the BE accepts both string/number for JSON numbers.

import api from './api';

// GET /api/v1/manager/membership-offers
// Backend returns an array (not a page wrapper). Returns [] when empty.
export async function listMembershipOffersAdmin() {
  const { data } = await api.get('/manager/membership-offers');
  return Array.isArray(data) ? data : [];
}

// POST /api/v1/manager/membership-offers
// payload = {
//   planCode: 'BASIC' | 'PLUS',
//   name: string (1..200),
//   description: string (non-empty),
//   priceAmount: number | string (>0),
//   durationDays: number (>0),
//   status?: 'ACTIVE' | 'INACTIVE' (defaults to ACTIVE on BE),
// }
export async function createMembershipOffer(payload) {
  const { data } = await api.post('/manager/membership-offers', payload);
  return data;
}

// PATCH /api/v1/manager/membership-offers/{offerId}
// `patch` may include any subset of: planCode, name, description,
// priceAmount, durationDays, status. Backend trims strings and validates
// required fields on creation.
export async function updateMembershipOffer(offerId, patch) {
  const { data } = await api.patch(
    `/manager/membership-offers/${offerId}`,
    patch,
  );
  return data;
}