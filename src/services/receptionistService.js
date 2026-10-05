// Receptionist-scoped API calls.
//
// Contract sources (read from the backend OpenAPI files, not guessed):
//   us11-receptionist-member-profile.yaml
//   us12-membership-offer-list.yaml
//   us15-receptionist-create-member.yaml
//   us16-membership-order.yaml
//
// Endpoints (all bearer-auth, role RECEPTIONIST unless noted):
//   GET   /reception/members/search?memberId|phone       searchReceptionMember
//   GET   /reception/members/{memberId}/profile          getReceptionMemberProfile
//   PATCH /reception/members/{memberId}/profile          updateReceptionMemberProfile
//   POST  /reception/members/{memberId}/reset-password   resetReceptionMemberPassword
//   POST  /reception/members                             createReceptionMember
//   POST  /reception/members/{memberId}/membership-orders createReceptionMembershipOrder
//   GET   /reception/members/{memberId}/membership-orders/pending resumeReceptionPendingOrder
//
// Sellable offers (US12 `GET /membership-offers`) are intentionally NOT
// declared here — `membershipService.listActiveOffers` already wraps that
// endpoint and the backend allows both MEMBER and RECEPTIONIST to call it.
//
// IMPORTANT — the deliberate omissions, updated for US20:
//   1. No bank-transfer "continue payment" endpoint. US18 owns that flow.
//   2. No bookings/sessions/attendance. No such endpoint or user story
//      exists yet. `classService.js` still carries placeholder comments.
//
// `memberId` everywhere is the public member code (^MB-[0-9]+$), never an
// account UUID. Read-only fields (accountId, role, status, version) must
// never be sent in a PATCH body — the backend returns MALFORMED_REQUEST.

import api from './api';

// GET /api/v1/reception/members/search
// Exactly one of `memberId` or `phone` must be supplied (mutually
// exclusive) or the backend answers 400 VALIDATION_ERROR. Returns a single
// MemberSearchResponse — there is no list variant and no pagination.
export async function searchReceptionMember({ memberId, phone } = {}) {
  const params = {};
  if (memberId && memberId.trim()) params.memberId = memberId.trim();
  if (phone && phone.trim()) params.phone = phone.trim();
  const { data } = await api.get('/reception/members/search', { params });
  return data;
}

// GET /api/v1/reception/members/{memberId}/profile
export async function getReceptionMemberProfile(memberId) {
  const { data } = await api.get(`/reception/members/${memberId}/profile`);
  return data;
}

// PATCH /api/v1/reception/members/{memberId}/profile
// `patch` keys must be a subset of:
//   fullName, phone, email, birthDate, profileImageUrl, fitnessGoal,
//   emergencyContactName, emergencyContactPhone
// Omitted keys are unchanged; explicit null clears the optional ones and is
// rejected for fullName/phone/email/birthDate. emergency-contact name and
// phone must both end up non-null or both null.
export async function updateReceptionMemberProfile(memberId, patch) {
  const { data } = await api.patch(`/reception/members/${memberId}/profile`, patch);
  return data;
}

// POST /api/v1/reception/members/{memberId}/reset-password
// 204 No Content — the caller gets no body and must not expect a password.
export async function resetReceptionMemberPassword(memberId) {
  await api.post(`/reception/members/${memberId}/reset-password`);
}

// POST /api/v1/reception/members
// US15. Body keys must be a subset of:
//   fullName, phone, email, birthDate, profileImageUrl
// All of fullName/phone/email/birthDate are required. The default password
// is derived from the phone server-side and is never returned.
export async function createReceptionMember(payload) {
  const { data } = await api.post('/reception/members', payload);
  return data;
}

// POST /api/v1/reception/members/{memberId}/membership-orders
// US16, bank transfer only. Body is exactly { offerId } — nothing else is
// accepted (additionalProperties: false). Returns 201 with the Order
// snapshot, status always PENDING_PAYMENT.
export async function createReceptionMembershipOrder(memberId, { offerId }) {
  const { data } = await api.post(
    `/reception/members/${memberId}/membership-orders`,
    { offerId },
  );
  return data;
}

// GET /api/v1/reception/members/{memberId}/membership-orders/pending
// 200 -> pending Order payload, 204 -> none exists.
export async function getReceptionPendingOrder(memberId) {
  try {
    const { data, status } = await api.get(
      `/reception/members/${memberId}/membership-orders/pending`,
    );
    if (status === 204) return null;
    return data;
  } catch (error) {
    // Axios rejects 204 in some configurations; treat it as "no order".
    if (error?.response?.status === 204) return null;
    throw error;
  }
}

// POST /api/v1/reception/members/{memberId}/cash-payments
// US20 — confirm a cash payment taken at the front desk.
//
// This is a SINGLE atomic call: the backend creates the Order AND the
// Payment AND the Membership AND the Receipt in one transaction. That is
// why the body is only `{ offerId }` — there is no create-order step and
// no separate confirm step to sequence.
//
// Body is exactly { offerId }; nothing else is accepted.
//
// Preconditions the backend enforces (all surface as 409):
//   - member must be ACTIVE
//   - member must NOT already hold an ACTIVE membership
//   - member must NOT already have a PENDING_PAYMENT order
//   - offer must be ACTIVE
//
// Because those 409s are business outcomes rather than bugs, the caller
// should read `err.response.data.code` and render the matching message
// instead of showing a generic failure.
//
// Returns 201 with PaymentResultResponse:
//   { paymentId, orderId, status, method, membershipId, receiptId, paidAt }
// For a cash payment every one of those is populated immediately — the
// Membership and Receipt exist by the time this returns (BR-PAY-15).
export async function createReceptionCashPayment(memberId, { offerId }) {
  const { data } = await api.post(
    `/reception/members/${memberId}/cash-payments`,
    { offerId },
  );
  return data;
}

// PATCH /api/v1/membership-orders/{orderId}/cancel
// body: { reason }  -> reason is REQUIRED (blank -> 400 VALIDATION_ERROR)
//
// Unblocks the counter when a pending bank-transfer order was created by
// mistake. The Order goes to EXPIRED (not "CANCELLED" — the status enum has
// no such member) and any PENDING Payment rows are flipped to FAILED, so
// the member stops blocking new orders. Idempotency is NOT guaranteed:
// cancelling an order that is no longer PENDING_PAYMENT is a 409.
//
// Role: the security config allows this for any authenticated staff and the
// service's ensureAny() accepts MANAGER or RECEPTIONIST (both must be
// ACTIVE) — a MEMBER is rejected.
export async function cancelMembershipOrder(orderId, { reason }) {
  const { data } = await api.patch(`/membership-orders/${orderId}/cancel`, {
    reason,
  });
  return data;
}

// GET /api/v1/receipts/{receiptId}
// -> ReceiptResponse: { receiptId, receiptNumber, paymentId, orderId,
//                       memberAccountId, amount, currency, paymentMethod, issuedAt }
//
// Note what is NOT in that payload: no member name, no member code, no plan
// name, no duration. The receipt screen has to resolve those itself, and it
// cannot for a receipt whose order it cannot read — see the note on
// `getReceptionMembershipHistory` in the page.
//
// Authorization (as of backend commit 4012273, "allow receptionist bank
// transfer receipt access"):
//   MEMBER       -> only their own receipts
//   COACH        -> 403 always
//   RECEPTIONIST -> any receipt
//   MANAGER      -> any receipt
// So a 403 here means either a coach, or a member reading someone else's
// receipt. There is no longer a "bank-transfer needs a manager" case — an
// earlier version of this file documented that, and it was wrong once
// PaymentService.receipt() dropped its CASH-only check.
export async function getReceipt(receiptId) {
  const { data } = await api.get(`/receipts/${receiptId}`);
  return data;
}

// GET /api/v1/reception/members/{memberId}/receipts
// -> ReceiptResponse[] (newest first: `order by issued_at desc, id desc`)
//
// `memberId` is the public member code (^MB-[0-9]+$), not an account UUID —
// the backend looks up member_profiles.member_code and 404s if it is unknown
// or does not belong to a MEMBER account.
//
// RECEPTIONIST and MANAGER (backend commit 63badea widened this from
// RECEPTIONIST only: SecurityConfiguration uses hasAnyRole and the service
// calls ensureAny(actor)). A coach is still refused. The individual
// getReceipt() is open to any non-coach, so this list is the only way to
// enumerate a member's receipts.
export async function getReceptionMemberReceipts(memberId) {
  const { data } = await api.get(`/reception/members/${memberId}/receipts`);
  return data;
}
