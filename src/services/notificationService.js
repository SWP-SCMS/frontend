import api from './api';

function normalizePage(data, page, size) {
  if (!data || !Array.isArray(data.content)) {
    throw new TypeError('Invalid notification page response');
  }
  return {
    content: data.content,
    page: Number.isInteger(data.page) ? data.page : page,
    size: Number.isInteger(data.size) ? data.size : size,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
    unreadCount: Number(data.unreadCount) || 0,
  };
}

export async function listNotifications({ unreadOnly = false, page = 0, size = 20 } = {}) {
  const { data } = await api.get('/notifications', {
    params: { unreadOnly, page, size },
  });
  return normalizePage(data, page, size);
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
  );
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data;
}
