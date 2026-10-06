// Payment service.
//
// The handoff §9 ("Pending Order / Continue Payment") is explicit: the FE
// must not expose separate `createPayment` and `resumePayment` calls.
// The backend handles create-or-resume internally, so the FE just has one
// "continue payment" entry point per actor scope.

import api from './api';

// POST /api/v1/members/me/payments/continue
// Backend semantics:
//   - if no PENDING Payment exists -> create Payment + QR
//   - if PENDING Payment exists -> return existing Payment + QR
//   - never create duplicate Payment (idempotent under retry).
export async function continueMyPayment() {
  const { data } = await api.post('/members/me/payments/continue');
  return data;
}
