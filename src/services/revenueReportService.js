// Manager revenue / membership report (US22).
//
// Endpoint (bearer-auth, MANAGER-only — backend enforces BR-RPT-01):
//   GET /api/v1/manager/reports/membership-revenue
//
// Query params (all optional):
//   from              Instant (ISO-8601, UTC) — lower bound, inclusive.
//   to                Instant (ISO-8601, UTC) — upper bound, EXCLUSIVE
//                     (the BE SQL uses `column < ?`, so `to` is a strict
//                     upper bound — callers wanting "through the end of
//                     2026-10-04" must pass the start of the next day).
//   includeTestData   boolean — when false (default) the BE excludes rows
//                     whose membership order is flagged `is_test_data`.
//
// BR-RPT-02: revenue counts ONLY `status = 'PAID'` payments. PENDING and
// FAILED payments are reported as counts but never contribute to the
// revenue figure. The UI relies on this — do not sum anything client-side.
//
// Note on the time buckets used by the BE:
//   - PAID   is bucketed by `paid_at`   (when the money actually landed)
//   - PENDING is bucketed by `created_at`
//   - FAILED  is bucketed by `updated_at`
//   - Membership counts (active/expired) are NOT date-ranged at all — the
//     BE counts current state of memberships in scope, filtered only by
//     `includeTestData`. So the two membership KPIs are a snapshot "hôm
//     nay", not a period total. The UI labels them accordingly.

import api from './api';

// Convert a `yyyy-MM-dd` input value to the start-of-day Instant the BE
// expects, expressed in UTC. Returns null for empty input so the param is
// omitted entirely (BE treats null `from`/`to` as "unbounded").
function toUtcStartOfDay(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// GET /api/v1/manager/reports/membership-revenue
// Resolves to the BE record:
//   { from, to, paidPayments, paidRevenue, pendingPayments, failedPayments,
//     activeMemberships, expiredMemberships, includesTestData }
export async function fetchRevenueReport({
  from,
  to,
  includeTestData = false,
} = {}) {
  const params = {};

  const fromInstant = toUtcStartOfDay(from);
  if (fromInstant) params.from = fromInstant;

  // `to` is exclusive on the BE, so a "through this day" selection must be
  // sent as the following day's start. We accept an inclusive date from the
  // UI and shift it here to keep that detail out of the components.
  const toInclusive = toUtcStartOfDay(to);
  if (toInclusive) {
    const nextDay = new Date(toInclusive);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    params.to = nextDay.toISOString();
  }

  params.includeTestData = includeTestData ? 'true' : 'false';

  const { data } = await api.get('/manager/reports/membership-revenue', { params });
  return data;
}