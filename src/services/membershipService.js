// Public membership offer browsing. The handoff prefers these as public,
// read-only endpoints that only expose ACTIVE offers.

import api from './api';

// GET /api/v1/membership-offers?planCode=BASIC|PLUS
// planCode is optional; backend returns [] when nothing matches.
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
