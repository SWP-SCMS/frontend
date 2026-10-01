// AuthContext
//
// Token decisions (handoff §5):
//   - Access token: 15 min, stored in memory only. Never written to
//     localStorage / sessionStorage.
//   - Refresh token: 7 days, stored by backend in HttpOnly cookie. The FE
//     does not read or persist it.
//   - The shared Axios instance (services/api.js) handles the bearer
//     header injection and the silent refresh + retry.
//
// State shape kept deliberately small: anything the UI needs to decide
// "who am I, am I allowed here" lives here. Domain data (e.g. full
// profile) lives in feature pages and is fetched on demand.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  registerUnauthorizedHandler,
  clearUnauthorizedHandler,
  setAccessToken,
} from '../services/api';
import {
  loginRequest,
  logoutRequest,
  refreshSession,
} from '../services/authService';
import { getMyProfile } from '../services/memberService';
import { AuthContext } from './AuthContextObject';

// One-time bootstrap flag so we don't fire /members/me/profile on every
// component remount.
let bootstrapPromise = null;

export function AuthProvider({ children }) {
  // `user` is the bootstrap profile fetched after a successful login or
  // silent refresh. `null` while we don't know yet; once we know the user
  // is unauthenticated we keep it null and the routing guards do the rest.
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const [error, setError] = useState(null);

  // We need to know the current status inside the unauthorized callback
  // without re-creating it every render.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearAuthState = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Called by services/api.js when refresh fails or a 401 can't be recovered.
  const handleUnauthorized = useCallback(() => {
    if (statusRef.current === 'unauthenticated') return;
    clearAuthState();
  }, [clearAuthState]);

  // Bootstrap on mount: try a silent refresh, then load the profile if we
  // got a token. Shared across mounts via module-level promise so React
  // StrictMode double-mount doesn't trigger two refreshes.
  useEffect(() => {
    registerUnauthorizedHandler(handleUnauthorized);
    return () => clearUnauthorizedHandler();
  }, [handleUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    bootstrapPromise =
      bootstrapPromise ||
      (async () => {
        const token = await refreshSession();
        if (!token) return null;
        setAccessToken(token);
        try {
          return await getMyProfile();
        } catch {
          return null;
        }
      })();

    bootstrapPromise.then((profile) => {
      bootstrapPromise = null;
      if (cancelled) return;
      if (profile) {
        setUser(profile);
        setStatus('authenticated');
      } else {
        setAccessToken(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ identifier, password }) => {
    setError(null);
    try {
      const result = await loginRequest({ identifier, password });
      const token = result?.accessToken;
      if (!token) {
        throw new Error('Thiếu accessToken trong phản hồi đăng nhập.');
      }
      setAccessToken(token);

      // The login response includes role + fullName. We still fetch the
      // full profile to keep a single source of truth for the UI.
      const profile = await getMyProfile().catch(() => ({
        accountId: result.accountId,
        role: result.role,
        fullName: result.fullName,
        memberId: result.memberId ?? null,
      }));

      setUser(profile);
      setStatus('authenticated');
      return profile;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => {});
    clearAuthState();
  }, [clearAuthState]);

  // Used by change-password flow (handoff §8.1): backend terminates the
  // current session, FE must clear auth state and let routing send the
  // user back to /login.
  const terminateSession = useCallback(async () => {
    // We do NOT call /auth/logout here — the backend just invalidated the
    // session. Clearing local state is enough.
    clearAuthState();
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      memberId: user?.memberId ?? null,
      isAuthenticated: status === 'authenticated',
      isReady: status !== 'loading',
      status,
      error,
      login,
      logout,
      terminateSession,
      // Allow pages to refresh the cached profile after PATCH calls.
      setUser,
    }),
    [user, status, error, login, logout, terminateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
