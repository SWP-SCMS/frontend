import api from './api';
import { gymLocalDateToIsoInstant } from '../utils/gymTime';

// UI dates are inclusive business dates. The API accepts [from,to) instants.
export async function fetchRevenueReport({ from, to, includeTestData = false } = {}) {
  const params = { includeTestData };
  if (from) params.from = gymLocalDateToIsoInstant(from, '00:00');
  if (to) {
    const nextDay = new Date(to + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    params.to = gymLocalDateToIsoInstant(nextDay.toISOString().slice(0, 10), '00:00');
  }
  const data = (await api.get('/manager/reports/revenue', { params })).data;
  if (!['total', 'membership', 'course'].every(source => data?.[source]
    && ['paidPayments', 'paidRevenue', 'completedRefundAmount', 'netRevenue', 'pendingPayments', 'failedPayments', 'pendingRefundAmount']
      .every(field => data[source][field] != null && Number.isFinite(Number(data[source][field]))))) {
    throw new Error('Dữ liệu báo cáo chưa đầy đủ. Vui lòng kiểm tra phiên bản backend.');
  }
  return data;
}
