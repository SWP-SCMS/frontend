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

export async function listCoachAssignedMembers({ q, page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (q && q.trim()) params.q = q.trim();
  const { data } = await api.get('/coach/members', { params });
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

export async function listCoachTrainingPlanVersions(memberAccountId, planId) {
  const { data } = await api.get(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-plans/${encodeURIComponent(planId)}/versions`,
  );
  if (!Array.isArray(data)) {
    throw new TypeError('Invalid training plan version response');
  }
  return data;
}

export async function archiveCoachTrainingPlan(memberAccountId, planId) {
  const { data } = await api.post(
    `/coach/members/${encodeURIComponent(memberAccountId)}/training-plans/${encodeURIComponent(planId)}/archive`,
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

async function fetchMyResults(type, page, size) {
  const { data } = await api.get('/members/me/training-results', {
    params: { type, page, size },
  });
  return normalizePage(data, page, size);
}

function trainingHistoryType(item) {
  if (item.courseSessionId) return 'COURSE';
  if (item.classSessionId && item.className != null) return 'CLASS';
  return 'PT';
}

export async function listMyTrainingResults({ type, page = 0, size = 20 } = {}) {
  const result = await fetchMyResults(type, page, size);
  if (!type) return result;
  // Older API versions ignore type. Their response omits the new runCode field.
  if (result.content.length && result.content.every(item =>
    Object.hasOwn(item, 'runCode') && trainingHistoryType(item) === type)) return result;

  let rows = result.content;
  if (result.totalPages > 1 || (page > 0 && !rows.length)) {
    const first = await fetchMyResults(undefined, 0, 100);
    rows = [...first.content];
    for (let i = 1; i < first.totalPages; i++) {
      rows.push(...(await fetchMyResults(undefined, i, 100)).content);
    }
  }
  return paginateTrainingHistory(rows, type, page, size);
}

function paginateTrainingHistory(rows, type, page, size) {
  const matches = rows.filter(item => trainingHistoryType(item) === type)
    .sort((a, b) => Date.parse(b.sessionStartTime || b.activityAt || b.createdAt) - Date.parse(a.sessionStartTime || a.activityAt || a.createdAt));
  return { content: matches.slice(page * size, (page + 1) * size), page, size,
    totalElements: matches.length, totalPages: Math.ceil(matches.length / size) };
}

async function fetchFeedbackPage(page, size) {
  const { data } = await api.get('/members/me/feedback', {
    params: { page, size },
  });
  return normalizePage(data, page, size);
}

export async function listMyTrainingFeedback({ type, page = 0, size = 20 } = {}) {
  if (!type) return fetchFeedbackPage(page, size);
  const first = await fetchFeedbackPage(0, 100);
  const rows = [...first.content];
  for (let i = 1; i < first.totalPages; i++) {
    rows.push(...(await fetchFeedbackPage(i, 100)).content);
  }
  return paginateTrainingHistory(rows, type, page, size);
}
