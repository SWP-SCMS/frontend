// Auth-related API calls. All endpoints here are still placeholders for
// the backend OpenAPI contract — see handoff §14 for the highest-priority
// integration endpoints.

import axios from 'axios';
import { API_BASE_URL } from '../constants';
import api from './api';

// Use a dedicated Axios instance for /auth/* so we can attach metadata
// flags that the shared interceptor uses to avoid recursion.
const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

// Mark every request through this instance so the shared interceptor
// won't try to refresh on its own 401s.
authApi.interceptors.request.use((config) => {
  config.__scmsIsRefresh = config.__scmsIsRefresh ?? true;
  return config;
});

// POST /api/v1/auth/login
// Success: { accessToken, expiresIn, accountId, role, fullName, memberId? }
export async function loginRequest({ identifier, password }) {
  const { data } = await authApi.post('/auth/login', { identifier, password });
  return data;
}

// POST /api/v1/auth/refresh — uses HttpOnly cookie, no body needed.
// Success has the same AuthResponse shape as login. Keep the complete
// response because AuthContext needs accountId/fullName/role after a hard
// refresh; callers that only need the token can select `accessToken`.
export async function refreshSession() {
  try {
    const { data } = await authApi.post('/auth/refresh', {});
    return data?.accessToken ? data : null;
  } catch {
    return null;
  }
}

// POST /api/v1/auth/logout
export async function logoutRequest() {
  try {
    await authApi.post('/auth/logout', {});
  } catch {
    // Logout should never throw to the caller; backend may already have
    // cleared the cookie. AuthContext will clear local state regardless.
  }
}

// POST /api/v1/auth/register — member self-registration.
// Expected: 201 Created, no auto-login.
export async function registerRequest(payload) {
  const { data } = await authApi.post('/auth/register', payload);
  return data;
}

export async function verifyEmailRequest({ email, otp }) {
  const { data } = await authApi.post('/auth/email-verification/verify', {
    email,
    otp,
  });
  return data;
}

export async function resendVerificationEmailRequest({ email }) {
  const { data } = await authApi.post('/auth/email-verification/resend', {
    email,
  });
  return data;
}

export async function changePendingEmailRequest({ newEmail, csrfToken }) {
  const { data } = await authApi.post(
    '/auth/email-verification/change-email',
    { newEmail },
    { headers: { 'X-Pending-CSRF': csrfToken } },
  );
  return data;
}

// POST /api/v1/auth/change-password
// Expected: 204 No Content.
// BR-ACC-24: đổi mật khẩu cần người dùng đã đăng nhập, nên phải gửi kèm
// Bearer token. Dùng `api` (tự gắn token + tự refresh khi 401) thay vì
// `authApi` (không gắn token).
export async function changePasswordRequest({ currentPassword, newPassword }) {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

// Public email-OTP password reset. The verified reset session is kept only in
// an HttpOnly cookie, so all three calls must use authApi with credentials.
export async function requestPasswordReset(email) {
  const { data } = await authApi.post('/auth/password-reset/request', { email });
  return data;
}

export async function verifyPasswordReset({ email, otp }) {
  const { data } = await authApi.post('/auth/password-reset/verify', {
    email,
    otp,
  });
  return data;
}

export async function confirmPasswordReset({ newPassword, confirmPassword }) {
  await authApi.post('/auth/password-reset/confirm', {
    newPassword,
    confirmPassword,
  });
}
