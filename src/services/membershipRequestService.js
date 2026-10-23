import api from './api';

function pageParams(page = 0, size = 20) {
  return { page, size };
}

export async function listMyTerminationRequests(page = 0, size = 20) {
  const { data } = await api.get('/members/me/membership-termination-requests', {
    params: pageParams(page, size),
  });
  return data;
}

export async function createMyTerminationRequest(payload) {
  const { data } = await api.post(
    '/members/me/membership-termination-requests',
    payload,
  );
  return data;
}

export async function withdrawMyTerminationRequest(requestId) {
  await api.delete(
    `/members/me/membership-termination-requests/${encodeURIComponent(requestId)}`,
  );
}

export async function listMyFreezeRequests(page = 0, size = 20) {
  const { data } = await api.get('/members/me/membership-freeze-requests', {
    params: pageParams(page, size),
  });
  return data;
}

export async function createMyFreezeRequest(payload) {
  const { data } = await api.post(
    '/members/me/membership-freeze-requests',
    payload,
  );
  return data;
}

export async function listManagerTerminationRequests(page = 0, size = 50) {
  const { data } = await api.get('/manager/membership-termination-requests', {
    params: pageParams(page, size),
  });
  return data;
}

export async function decideTerminationRequest(requestId, decision, payload) {
  const { data } = await api.post(
    `/manager/membership-termination-requests/${encodeURIComponent(requestId)}/${decision}`,
    payload,
  );
  return data;
}

export async function createManagerDirectTermination(memberAccountId, payload) {
  const { data } = await api.post(
    `/manager/members/${encodeURIComponent(memberAccountId)}/membership-termination-requests`,
    payload,
  );
  return data;
}

export async function listManagerFreezeRequests(page = 0, size = 50) {
  const { data } = await api.get('/manager/membership-freeze-requests', {
    params: pageParams(page, size),
  });
  return data;
}

export async function decideFreezeRequest(requestId, decision, payload) {
  const { data } = await api.post(
    `/manager/membership-freeze-requests/${encodeURIComponent(requestId)}/${decision}`,
    payload,
  );
  return data;
}

export async function listReceptionTerminationRequests(memberCode, page = 0, size = 20) {
  const { data } = await api.get(
    `/reception/members/${encodeURIComponent(memberCode)}/membership-termination-requests`,
    { params: pageParams(page, size) },
  );
  return data;
}

export async function createReceptionTerminationRequest(memberCode, payload) {
  const { data } = await api.post(
    `/reception/members/${encodeURIComponent(memberCode)}/membership-termination-requests`,
    payload,
  );
  return data;
}

export async function listReceptionFreezeRequests(memberCode, page = 0, size = 20) {
  const { data } = await api.get(
    `/reception/members/${encodeURIComponent(memberCode)}/membership-freeze-requests`,
    { params: pageParams(page, size) },
  );
  return data;
}

export async function createReceptionFreezeRequest(memberCode, payload) {
  const { data } = await api.post(
    `/reception/members/${encodeURIComponent(memberCode)}/membership-freeze-requests`,
    payload,
  );
  return data;
}

export async function collectFreezeCashPayment(requestId, expectedVersion) {
  const { data } = await api.post(
    `/reception/membership-freeze-requests/${encodeURIComponent(requestId)}/cash-payment`,
    { expectedVersion },
  );
  return data;
}
