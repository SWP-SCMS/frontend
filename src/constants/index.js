// Application-wide constants. Keep this file dependency-free so it can be
// imported from both client and tooling code without pulling in side effects.

// Roles are the exact strings the backend emits on JWT/session payloads.
// Keep these aligned with backend account.role values.
export const ROLES = Object.freeze({
  MEMBER: 'MEMBER',
  RECEPTIONIST: 'RECEPTIONIST',
  COACH: 'COACH',
  MANAGER: 'MANAGER',
});

// Friendly Vietnamese labels for roles. UI-only.
export const ROLE_LABELS = Object.freeze({
  [ROLES.MEMBER]: 'Hội viên',
  [ROLES.RECEPTIONIST]: 'Lễ tân',
  [ROLES.COACH]: 'Huấn luyện viên',
  [ROLES.MANAGER]: 'Quản lý',
});

// Account / membership statuses used across the app. Backend remains the
// source of truth; these are listed here only for switch statements and
// chip colors.
export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
});

export const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
});

export const MEMBERSHIP_PLAN = Object.freeze({
  BASIC: 'BASIC',
  PLUS: 'PLUS',
});

// Storage keys for non-secret client preferences. We deliberately do NOT
// persist auth tokens here (see AuthContext notes).
export const STORAGE_KEYS = Object.freeze({
  LANGUAGE: 'scms.language',
  THEME: 'scms.theme',
});

// API base URL. Vite replaces import.meta.env.* at build time. We expose a
// safe default so missing env files don't crash the app at import time, but
// the real value should always be set via .env.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Access token lifetime in seconds. Must match backend.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Refresh token lifetime. The value is not used directly by the FE (the
// HttpOnly cookie is owned by the backend) but it is documented here so
// engineers understand the trade-off.
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
