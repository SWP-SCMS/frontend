// Single shared Axios instance.
//
// Decisions (see handoff §5):
//   - base URL comes from VITE_API_BASE_URL (never hardcoded).
//   - `withCredentials: true` so the backend HttpOnly refresh cookie is
//     sent on every request.
//   - Access token lives in memory (AuthContext). It is injected per
//     request via an interceptor — we do NOT read it from localStorage.
//   - A 401 caused by an expired access token triggers a single
//     in-flight refresh attempt; concurrent callers share the same
//     promise so we never spam /auth/refresh.
//   - If refresh fails, we surface an `auth:logout` event and reject.

import axios from 'axios';
import { API_BASE_URL } from '../constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

// In-memory access token reference. The provider (AuthContext) calls
// `setAccessToken()` on login and `setAccessToken(null)` on logout.
let accessToken = null;
let accessTokenPayload = null; // Decoded JWT payload — small role data for bootstrap.
let onUnauthorized = null; // () => void, registered by AuthContext

export function setAccessToken(token) {
  accessToken = token || null;
  accessTokenPayload = decodeJwtPayload(accessToken);
}

export function getAccessToken() {
  return accessToken;
}

// Returns the decoded JWT payload of the current access token, or null if
// no token is set / the token is malformed. Used by AuthContext.bootstrap
// to seed a minimal profile for non-MEMBER roles (which can't call
// /members/me/profile).
export function getAccessTokenPayload() {
  return accessTokenPayload;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function registerUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

export function clearUnauthorizedHandler() {
  onUnauthorized = null;
}

// ----- Refresh coordination -----
//
// A single `refreshPromise` is shared by all concurrent 401-handling
// requests. When a refresh is already running, additional 401s await it
// instead of triggering their own /auth/refresh call.
let refreshPromise = null;

async function performRefresh() {
  // Import lazily so we don't create a circular module graph.
  const { refreshSession } = await import('../services/authService');
  return refreshSession();
}

// Attach the bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  if (accessToken && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 by attempting a refresh + retry once.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error || {};
    const status = response?.status;

    // Network error or no response -> reject as-is.
    if (!response || !config) {
      return Promise.reject(error);
    }

    const alreadyRetried = config.__scmsRetried === true;
    const isRefreshCall = config.__scmsIsRefresh === true;

    // Only attempt refresh on 401, and not for the refresh call itself.
    if (status !== 401 || alreadyRetried || isRefreshCall) {
      return Promise.reject(error);
    }

    try {
      // De-dupe concurrent refresh attempts.
      refreshPromise = refreshPromise || performRefresh();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (!newToken) {
        // Refresh endpoint did not return a new access token.
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(error);
      }

      setAccessToken(newToken);
      config.__scmsRetried = true;
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${newToken}`;
      return api.request(config);
    } catch (refreshErr) {
      refreshPromise = null;
      if (onUnauthorized) onUnauthorized();
      return Promise.reject(refreshErr);
    }
  },
);

export default api;
