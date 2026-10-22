import api from './api';

// Shared verified email-change flow for every authenticated account role.
export async function getAccountEmailChangeStatus() {
  const { data } = await api.get('/accounts/me/email-change');
  return data;
}

export async function beginAccountEmailChange(payload) {
  const { data } = await api.post('/accounts/me/email-change', payload);
  return data;
}

export async function replaceAccountEmailChange(payload) {
  const { data } = await api.put('/accounts/me/email-change', payload);
  return data;
}

export async function verifyAccountEmailChange(payload) {
  const { data } = await api.post('/accounts/me/email-change/verify', payload);
  return data;
}

export async function resendAccountEmailChange() {
  const { data } = await api.post('/accounts/me/email-change/resend');
  return data;
}

export async function cancelAccountEmailChange() {
  await api.delete('/accounts/me/email-change');
}
