// Manager-scoped Recurring Schedule API (US26).
//
// Endpoint (bearer-auth, MANAGER-only — backend enforces BR-SEC-04):
//   POST /api/v1/manager/recurring-schedules           createRecurringSchedule
//
// Notes:
//   - The BE always generates exactly 30 ClassSession rows inside a
//     single @Transactional batch. Either all 30 are created or none
//     are (BR-REC-04, BR-INT-03).
//   - The FE sends ONE request and lets the BE do the 30-occurrence
//     generation + conflict detection (BR-REC-02, BR-REC-03, BR-CLS-05,
//     BR-CLS-06, BR-VAL-SCH-04). The FE does NOT pre-compute or persist
//     occurrences.
//   - There is no list / detail / update / delete endpoint for recurring
//     schedules today. The FE is creation-only.
//   - The request body is validated field-by-field on the server; the
//     FE also mirrors the deterministic rules in Zod to surface inline
//     errors before the network call.

import api from './api';

// POST /api/v1/manager/recurring-schedules
export async function createRecurringSchedule(payload) {
  const { data } = await api.post('/manager/recurring-schedules', payload);
  return data;
}
