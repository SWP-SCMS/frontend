// Member-scoped service calls. Used by AuthContext (me/profile on bootstrap)
// and the Member dashboard pages.
//
// NOTE: /members/me/profile is a Member-only endpoint on the backend
// (SecurityConfiguration restricts it to hasRole("MEMBER")). For other roles
// (MANAGER/RECEPTIONIST/COACH) we synthesize a minimal profile from the JWT
// claims — the backend exposes `role`, `fullName`, `accountId`, and an
// optional `memberId` in the access token, which is enough for the
// AuthContext to bootstrap role-aware routing.

import api from './api';

// GET /api/v1/members/me/profile — Member-only endpoint (BE restricts
// this path to hasRole("MEMBER")). Callers needing role-safe bootstrap
// should use `buildProfileFromToken` instead.
export async function getMyProfile() {
  const { data } = await api.get('/members/me/profile');
  return data;
}

// Role-aware profile loader used by AuthContext on bootstrap.
// - MEMBER: hits /members/me/profile (full member profile).
// - Other roles: returns a synthetic profile derived from the JWT claims
//   stored in `accessTokenPayload`; no HTTP call needed.
// `accessTokenPayload` is the decoded JWT payload (set right after login).
export function buildProfileFromToken(accessTokenPayload) {
  if (!accessTokenPayload) return null;
  return {
    accountId: accessTokenPayload.sub,
    role: accessTokenPayload.role ?? null,
    fullName: accessTokenPayload.fullName ?? '',
    memberId: accessTokenPayload.memberId ?? null,
  };
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
