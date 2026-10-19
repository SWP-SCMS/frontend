import api from './api';

export async function listMembershipBenefits() {
  const { data } = await api.get('/manager/membership-benefits');
  return Array.isArray(data) ? data : [];
}

export async function listMembershipPlans() {
  const { data } = await api.get('/manager/membership-plans');
  return Array.isArray(data) ? data : [];
}

export async function getMembershipPlan(planCode) {
  const { data } = await api.get(
    `/manager/membership-plans/${encodeURIComponent(planCode)}`,
  );
  return data;
}

export async function createMembershipPlan(payload) {
  const { data } = await api.post('/manager/membership-plans', payload);
  return data;
}

export async function updateMembershipPlan(planCode, patch) {
  const { data } = await api.patch(
    `/manager/membership-plans/${encodeURIComponent(planCode)}`,
    patch,
  );
  return data;
}
