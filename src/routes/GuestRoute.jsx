// Route guard: requires an *unauthenticated* visitor. Used for /login and
// /register so that a member who is already logged in cannot open the
// auth forms (and inadvertently create a duplicate account via /register).
//
// We intentionally do NOT call any backend API here — the decision is
// purely client-side based on AuthContext. The server should still reject
// /auth/register when a valid token is present (defence in depth).

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function GuestRoute({ children }) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    // Auth bootstrap still running — let the splash render.
    return null;
  }

  if (isAuthenticated) {
    // Honor a `?next=` query param if the caller passed one (e.g. a deep
    // link from an email). Otherwise default to the member dashboard.
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    const target =
      next && next.startsWith('/') ? next : '/member/dashboard';
    return <Navigate to={target} replace />;
  }

  return children;
}
