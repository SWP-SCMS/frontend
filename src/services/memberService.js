// Member-scoped service calls. Used by AuthContext (me/profile on bootstrap)
// and the Member dashboard pages.

import api from './api';

// GET /api/v1/members/me/profile
export async function getMyProfile() {
  const { data } = await api.get('/members/me/profile');
  return data;
}

// PATCH /api/v1/members/me/profile — `null` clears optional fields, omitted
// fields are unchanged.
export async function updateMyProfile(patch) {
  const { data } = await api.patch('/members/me/profile', patch);
  return data;
}

// POST /api/v1/members/me/membership-orders
// Bank-transfer only; cash flow goes through Receptionist services.
export async function createMyMembershipOrder({ offerId }) {
  const { data } = await api.post('/members/me/membership-orders', { offerId });
  return data;
}

// GET /api/v1/members/me/membership-orders/pending
// 200 -> pending order payload, 204 -> none.
export async function getMyPendingMembershipOrder() {
  try {
    const { data, status } = await api.get(
      '/members/me/membership-orders/pending',
    );
    if (status === 204) return null;
    return data;
  } catch (error) {
    if (error?.response?.status === 204) return null;
    throw error;
  }
}
