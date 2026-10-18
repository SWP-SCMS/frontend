import api from './api';

function normalizePage(data, page, size) {
  if (!data || !Array.isArray(data.content)) {
    throw new TypeError('Invalid paged training response');
  }
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    page: Number.isInteger(data?.page) ? data.page : page,
    size: Number.isInteger(data?.size) ? data.size : size,
    totalElements: Number(data?.totalElements) || 0,
    totalPages: Number(data?.totalPages) || 0,
  };
}

export async function listCoachAssignedMembers({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/coach/members', { params: { page, size } });
  return normalizePage(data, page, size);
}

export async function getCoachAssignedMember(memberAccountId) {
  const { data } = await api.get(
    `/coach/members/${encodeURIComponent(memberAccountId)}`,
  );
  return data;
}

export async function listCoachTrainingPlans(
  memberAccountId,
  { page = 0, size = 20 } = {},
) {
  const { data } = await api.get(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-plans`,
    { params: { page, size } },
  );
  return normalizePage(data, page, size);
}

export async function listCoachTrainingResults(
  memberAccountId,
  { page = 0, size = 20 } = {},
) {
  const { data } = await api.get(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-results`,
    { params: { page, size } },
  );
  return normalizePage(data, page, size);
}

export async function listCoachTrainingFeedback(
  memberAccountId,
  { page = 0, size = 20 } = {},
) {
  const { data } = await api.get(
    `/coach/members/${encodeURIComponent(memberAccountId)}/feedback`,
    { params: { page, size } },
  );
  return normalizePage(data, page, size);
}

export async function getCoachSessionTrainingResult(sessionId, memberAccountId) {
  const response = await api.get(
    `/coach/class-sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(memberAccountId)}/training-results`,
  );
  return response.status === 204 ? null : response.data;
}

export async function getCoachSessionFeedback(sessionId, memberAccountId) {
  const response = await api.get(
    `/coach/class-sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(memberAccountId)}/feedback`,
  );
  return response.status === 204 ? null : response.data;
}

export async function createCoachTrainingPlan(memberAccountId, payload) {
  const { data } = await api.post(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-plans`,
    payload,
  );
  return data;
}

export async function updateCoachTrainingPlan(
  memberAccountId,
  planId,
  payload,
) {
  const { data } = await api.put(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-plans/${encodeURIComponent(planId)}`,
    payload,
  );
  return data;
}

export async function createCoachTrainingResult(memberAccountId, payload) {
  const { data } = await api.post(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-results`,
    payload,
  );
  return data;
}

export async function updateCoachTrainingResult(
  memberAccountId,
  resultId,
  payload,
) {
  const { data } = await api.put(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-results/${encodeURIComponent(resultId)}`,
    payload,
  );
  return data;
}

export async function createCoachTrainingFeedback(memberAccountId, payload) {
  const { data } = await api.post(
    `/coach/members/${encodeURIComponent(memberAccountId)}/feedback`,
    payload,
  );
  return data;
}

export async function updateCoachTrainingFeedback(
  memberAccountId,
  feedbackId,
  payload,
) {
  const { data } = await api.put(
    `/coach/members/${encodeURIComponent(memberAccountId)}/feedback/${encodeURIComponent(feedbackId)}`,
    payload,
  );
  return data;
}

export async function listMyTrainingPlans() {
  const { data } = await api.get('/members/me/training-plans');
  if (!Array.isArray(data)) {
    throw new TypeError('Invalid training plan list response');
  }
  return data;
}

export async function listMyTrainingResults({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/members/me/training-results', {
    params: { page, size },
  });
  return normalizePage(data, page, size);
}

export async function listMyTrainingFeedback({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/members/me/feedback', {
    params: { page, size },
  });
  return normalizePage(data, page, size);
}
