import api from './api';

function paramsWithPage({ status = 'PENDING', page = 0, size = 20 } = {}) {
  return { status, page, size };
}

export async function searchPendingVerificationAccount(query) {
  const { data } = await api.get(
    '/reception/email-verification/pending-accounts',
    { params: { query: query.trim() } },
  );
  return data;
}

export async function createManualActivationRequest(payload) {
  const { data } = await api.post(
    '/reception/email-verification/manual-activation-requests',
    payload,
  );
  return data;
}

export async function listReceptionManualActivationRequests(options) {
  const { data } = await api.get(
    '/reception/email-verification/manual-activation-requests',
    { params: paramsWithPage(options) },
  );
  return data;
}

export async function getReceptionManualActivationRequest(requestId) {
  const { data } = await api.get(
    `/reception/email-verification/manual-activation-requests/${encodeURIComponent(requestId)}`,
  );
  return data;
}

export async function listManagerManualActivationRequests(options) {
  const { data } = await api.get(
    '/manager/email-verification/manual-activation-requests',
    { params: paramsWithPage(options) },
  );
  return data;
}

export async function getManagerManualActivationRequest(requestId) {
  const { data } = await api.get(
    `/manager/email-verification/manual-activation-requests/${encodeURIComponent(requestId)}`,
  );
  return data;
}

export async function decideManualActivationRequest(
  requestId,
  decision,
  decisionNote,
) {
  const action = decision === 'APPROVE' ? 'approve' : 'reject';
  const { data } = await api.post(
    `/manager/email-verification/manual-activation-requests/${encodeURIComponent(requestId)}/${action}`,
    { decisionNote },
  );
  return data;
}
