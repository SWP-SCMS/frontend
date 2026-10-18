import api from './api';

export async function listMyReceipts() {
  const { data } = await api.get('/members/me/receipts');
  if (!Array.isArray(data)) {
    throw new TypeError('Invalid receipt list response');
  }
  return data;
}

export async function getMyReceipt(receiptId) {
  const { data } = await api.get(`/receipts/${encodeURIComponent(receiptId)}`);
  return data;
}
