// Manual Payment Reconciliation (US19).
//
// Endpoints:
//   GET  /api/v1/payments/reconciliation-queue   listReconciliationQueue
//   POST /api/v1/payments/{paymentId}/reconcile  reconcilePayment
//
// Access: RECEPTIONIST or MANAGER (backend `hasAnyRole("MANAGER",
// "RECEPTIONIST")` on `/payments/**`).
//
// ---------------------------------------------------------------------------
// BE STATUS: both endpoints below are implemented and served by
//   GET  /api/v1/payments/reconciliation-queue
//   POST /api/v1/payments/{paymentId}/reconcile
//   GET  /api/v1/payments/{paymentId}/result
// The queue contract (verified against ReconciliationQueueItem):
//   status: ALL | PENDING | EXPIRED_WINDOW  (BE enum, default ALL)
//   query:  free text -> order_number | payment id | member name |
//           bank transfer content
//   page/size: 0-based, size clamped 1..100 by the BE
// -> { content: [ReconciliationQueueItem], page, size, totalElements,
//      totalPages }
// ---------------------------------------------------------------------------

import api from './api';

export const RECONCILE_STATUS = {
  PAID: 'PAID',
  FAILED: 'FAILED',
};

// Mirrors the BE `ReconciliationQueueStatus` enum.
export const QUEUE_FILTER = {
  ALL: 'ALL',
  // Still inside the 24h window (BE treats a null expires_at as PENDING).
  PENDING: 'PENDING',
  // Window already lapsed — the only state where a manual FAILED is legal
  // (BR-PAY-17 / BR-PAY-08).
  EXPIRED_WINDOW: 'EXPIRED_WINDOW',
};

// POST /api/v1/payments/{paymentId}/reconcile
//
// payload:
//   status                 'PAID' | 'FAILED'        (required)
//   evidence               string                   (required, BR-VAL-COM-05)
//   reason                 string                   (required, BR-PAY-13/17)
//   receivedAmount         number                   (required when PAID)
//   transferContent        string                   (required when PAID)
//   providerTransactionId  string                   (required when PAID)
//
// The BE validates the three PAID-only fields against the stored Payment:
//   - receivedAmount must equal the Payment amount exactly (else 400)
//   - transferContent must equal the stored bank_transfer_content exactly
//     (BE uses `equals`, NOT `contains` — a substring will 400)
//   - providerTransactionId is recorded as evidence; the unique index on
//     it (uq_payments_provider_reference style) prevents double-fulfil.
//
// Response: PaymentResultResponse
//   { paymentId, orderId, status, method, membershipId, receiptId, paidAt }
export async function reconcilePayment(paymentId, payload) {
  const { data } = await api.post(`/payments/${paymentId}/reconcile`, payload);
  return data;
}

// GET /api/v1/payments/reconciliation-queue
export async function listReconciliationQueue({
  status = QUEUE_FILTER.ALL,
  query = '',
  page = 0,
  size = 20,
} = {}) {
  const params = { status, page, size };
  if (query && query.trim()) params.query = query.trim();

  const { data } = await api.get('/payments/reconciliation-queue', { params });
  return data;
}

// GET /api/v1/payments/{paymentId}/result
// Cheap way to re-read canonical state after a reconcile attempt.
export async function getPaymentResult(paymentId) {
  const { data } = await api.get(`/payments/${paymentId}/result`);
  return data;
}