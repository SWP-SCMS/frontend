import api from './api';
import { courseIdempotencyConfig } from './courseServiceUtils';

export const listCourseReconciliationQueue = async (params) =>
  (await api.get('/course-payments/reconciliation-queue', { params })).data;
export const getCourseReconciliationDetail = async (id) =>
  (await api.get(`/course-payments/${id}`)).data;
export const getCourseReconciliationResult = async (id) =>
  (await api.get(`/course-payments/${id}/result`)).data;
export const reconcileCoursePayment = async (id, payload, key) =>
  (await api.post(`/course-payments/${id}/reconcile`, payload, courseIdempotencyConfig(key))).data;
