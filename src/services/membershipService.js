// Membership offers (công khai) và lịch sử Membership của Hội viên.

import axios from 'axios';
import { API_BASE_URL } from '../constants';
import api from './api';

// Hai API Offer là CÔNG KHAI (không cần đăng nhập). Dùng một axios riêng,
// KHÔNG gắn Authorization: nếu gửi kèm một token cũ/hết hạn, BE trả 401 dù
// API vốn không yêu cầu đăng nhập.
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

// GET /api/v1/membership-offers?planCode={dynamicPlanCode}
// Chỉ trả Offer ACTIVE; planCode là tùy chọn; không có kết quả thì trả [].
// Trang của Lễ tân cũng dùng lại hàm này thay vì khai báo lại.
export async function listActiveOffers({ planCode } = {}) {
  const { data } = await publicApi.get('/membership-offers', {
    params: planCode ? { planCode } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

// GET /api/v1/membership-offers/{offerId}
export async function getOfferById(offerId) {
  const { data } = await publicApi.get(`/membership-offers/${offerId}`);
  return data;
}

// GET /api/v1/members/me/memberships — lịch sử Membership của chính Member
// (mới nhất trước). `status`: RESERVED | ACTIVE | EXPIRED | TERMINATED.
// RESERVED chưa có startsAt/endsAt; thời hạn chỉ được chốt khi tự kích hoạt.
export async function getMyMemberships() {
  const { data } = await api.get('/members/me/memberships');
  return Array.isArray(data) ? data : [];
}
