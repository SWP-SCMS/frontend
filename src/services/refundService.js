import api from './api';

export async function listReceptionRefundRequests({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/reception/refund-requests', {
    params: { page, size },
  });
  return data;
}

export async function createReceptionRefundRequest(memberCode, payload) {
  const { data } = await api.post(
    `/reception/members/${encodeURIComponent(memberCode)}/refund-requests`,
    payload,
  );
  return data;
}

export async function listRefundEligibleSources(memberCode) {
  const { data } = await api.get(
    `/reception/members/${encodeURIComponent(memberCode)}/refund-eligible-sources`,
  );
  return Array.isArray(data) ? data : [];
}

export async function recordRefundCashDisbursement(requestId, payload) {
  const { data } = await api.post(
    `/reception/refund-requests/${encodeURIComponent(requestId)}/cash-disbursement`,
    payload,
  );
  return data;
}

export async function listManagerRefundRequests({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/manager/refund-requests', {
    params: { page, size },
  });
  return data;
}

export async function firstApproveRefundRequest(requestId, payload) {
  const { data } = await api.post(
    `/manager/refund-requests/${encodeURIComponent(requestId)}/first-approval`,
    payload,
  );
  return data;
}

export async function finalApproveRefundRequest(requestId, payload) {
  const { data } = await api.post(
    `/manager/refund-requests/${encodeURIComponent(requestId)}/final-approval`,
    payload,
  );
  return data;
}

export async function rejectRefundRequest(requestId, payload) {
  const { data } = await api.post(
    `/manager/refund-requests/${encodeURIComponent(requestId)}/reject`,
    payload,
  );
  return data;
}
