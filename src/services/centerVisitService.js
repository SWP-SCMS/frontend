import api from './api';

function normalizePage(data, page, size) {
  if (!data || !Array.isArray(data.content)) {
    throw new TypeError('Invalid center visit page response');
  }
  return {
    content: data.content,
    page: Number.isInteger(data.page) ? data.page : page,
    size: Number.isInteger(data.size) ? data.size : size,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
  };
}

export async function listOpenCenterVisits({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/reception/center-visits/open', {
    params: { page, size },
  });
  return normalizePage(data, page, size);
}

export async function checkoutMemberCenterVisit(memberAccountId) {
  const { data } = await api.patch(
    `/reception/members/${encodeURIComponent(memberAccountId)}/center-visits/current/checkout`,
  );
  return data;
}
