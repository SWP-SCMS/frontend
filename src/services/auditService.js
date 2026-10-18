import api from './api';
import {
  gymEndOfDayIsoInstant,
  gymLocalDateToIsoInstant,
} from '../utils/gymTime';

export async function listAuditEvents({
  actorId = '',
  action = '',
  targetType = '',
  targetId = '',
  from = '',
  to = '',
  page = 0,
  size = 20,
} = {}) {
  const params = { page, size };
  if (actorId) params.actorId = actorId;
  if (action.trim()) params.action = action.trim();
  if (targetType.trim()) params.targetType = targetType.trim();
  if (targetId) params.targetId = targetId;
  const fromInstant = gymLocalDateToIsoInstant(from, '00:00');
  const toInstant = gymEndOfDayIsoInstant(to);
  if (fromInstant) params.from = fromInstant;
  if (toInstant) params.to = toInstant;

  const { data } = await api.get('/manager/audit-events', { params });
  if (!data || !Array.isArray(data.content)) {
    throw new TypeError('Invalid audit event page response');
  }
  return {
    content: data.content,
    page: Number.isInteger(data.page) ? data.page : page,
    size: Number.isInteger(data.size) ? data.size : size,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
  };
}
