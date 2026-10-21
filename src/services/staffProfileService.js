import api from './api';

// Shared by MANAGER, RECEPTIONIST and COACH.
export async function getMyStaffProfile() {
  const { data } = await api.get('/staff/me/profile');
  return data;
}

// Backend rejects unknown keys. Callers must build this object from the
// editable whitelist: fullName, phone and birthDate.
export async function updateMyStaffProfile(patch) {
  const { data } = await api.patch('/staff/me/profile', patch);
  return data;
}

export async function beginStaffEmailChange(payload) {
  const { data } = await api.post('/staff/me/email-change', payload);
  return data;
}

export async function verifyStaffEmailChange(payload) {
  const { data } = await api.post('/staff/me/email-change/verify', payload);
  return data;
}

export async function resendStaffEmailChange() {
  const { data } = await api.post('/staff/me/email-change/resend');
  return data;
}

export async function cancelStaffEmailChange() {
  await api.delete('/staff/me/email-change');
}
