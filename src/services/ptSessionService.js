import api from './api';

function cleanParams(params = {}) {
  const cleaned = {};
  if (params.from) cleaned.from = params.from;
  if (params.to) cleaned.to = params.to;
  if (params.page != null) cleaned.page = params.page;
  if (params.size != null) cleaned.size = params.size;
  return cleaned;
}

async function list(path, params) {
  const { data } = await api.get(path, { params: cleanParams(params) });
  return data;
}

export const listMemberPtSessions = (params) =>
  list('/members/pt-sessions', params);

export const listReceptionPtSessions = (params) =>
  list('/reception/pt-sessions', params);

export const listManagerPtSessions = (params) =>
  list('/manager/pt-sessions', params);

export const listCoachPtSessions = (params) =>
  list('/coach/pt-sessions', params);
