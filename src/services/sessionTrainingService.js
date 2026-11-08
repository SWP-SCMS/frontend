import api from './api';

function path(sessionId, memberId, kind, id) {
  const base = `/coach/class-sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(memberId)}/${kind}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

export async function saveSessionTrainingResult(sessionId, memberId, id, payload) {
  const { data } = await api[id ? 'put' : 'post'](path(sessionId, memberId, 'training-results', id), payload);
  return data;
}

export async function saveSessionTrainingFeedback(sessionId, memberId, id, payload) {
  const { data } = await api[id ? 'put' : 'post'](path(sessionId, memberId, 'feedback', id), payload);
  return data;
}

export async function saveSessionTrainingSummary(sessionId, memberId, payload) {
  const { data } = await api.put(path(sessionId, memberId, 'training-summary'), payload);
  return data;
}

function bookedPath(sessionId, memberId, course) {
  return `/coach/${course ? 'course' : 'pt'}-sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(memberId)}/training-summary`;
}

export async function getBookedSessionTraining(sessionId, memberId, course) {
  return (await api.get(bookedPath(sessionId, memberId, course))).data;
}

export async function saveBookedSessionTraining(sessionId, memberId, course, payload) {
  return (await api.put(bookedPath(sessionId, memberId, course), payload)).data;
}
