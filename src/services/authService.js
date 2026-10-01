// Auth-related API calls. All endpoints here are still placeholders for
// the backend OpenAPI contract — see handoff §14 for the highest-priority
// integration endpoints.

import axios from 'axios';
import { API_BASE_URL } from '../constants';

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
export async function refreshSession() {
  try {
    const { data } = await authApi.post('/auth/refresh', {});
    return data?.accessToken || null;
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

// POST /api/v1/auth/change-password
// Expected: 204 No Content.
export async function changePasswordRequest({ currentPassword, newPassword }) {
  await authApi.post('/auth/change-password', { currentPassword, newPassword });
}
