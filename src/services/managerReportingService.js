import api from './api';
import {
  gymEndOfDayIsoInstant,
  gymLocalDateToIsoInstant,
} from '../utils/gymTime';

export function buildReportParams({ from = '', to = '', includeTestData = false } = {}) {
  const params = { includeTestData };
  const fromInstant = gymLocalDateToIsoInstant(from, '00:00');
  const toInstant = gymEndOfDayIsoInstant(to);
  if (fromInstant) params.from = fromInstant;
  if (toInstant) params.to = toInstant;
  return params;
}

async function get(path, filters) {
  const { data } = await api.get(path, { params: buildReportParams(filters) });
  return data;
}

export function getManagerDashboard(filters) {
  return get('/manager/dashboard', filters);
}

export function getMemberReport(filters) {
  return get('/manager/reports/members', filters);
}

export function getBookingReport(filters) {
  return get('/manager/reports/bookings', filters);
}

export function getAttendanceReport(filters) {
  return get('/manager/reports/attendance', filters);
}

export function getCenterVisitReport(filters) {
  return get('/manager/reports/center-visits', filters);
}

export function getClassUtilizationReport(filters) {
  return get('/manager/reports/class-utilization', filters);
}
