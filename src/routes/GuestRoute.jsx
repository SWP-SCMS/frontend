// Route guard: requires an *unauthenticated* visitor. Used for /login and
// /register so that a member who is already logged in cannot open the
// auth forms (and inadvertently create a duplicate account via /register).
//
// We intentionally do NOT call any backend API here — the decision is
// purely client-side based on AuthContext. The server should still reject
// /auth/register when a valid token is present (defence in depth).

import { Navigate, useLocation } from 'react-router-dom';

import { ROLES } from '../constants';
import { useAuth } from '../context/useAuth';

// Same role-aware home map used by LoginPage so an already-authenticated
// user landing on /login (e.g. after refresh or back navigation) lands
// on the correct dashboard instead of being funneled to /member/dashboard.
const ROLE_HOME = {
  [ROLES.MEMBER]: '/member/dashboard',
  [ROLES.RECEPTIONIST]: '/reception',
  [ROLES.COACH]: '/coach',
  [ROLES.MANAGER]: '/manager/dashboard',
};

export default function GuestRoute({ children }) {
  const { isAuthenticated, isReady, role } = useAuth();
  const location = useLocation();

  if (!isReady) {
    // Auth bootstrap still running — let the splash render.
    return null;
  }

  if (isAuthenticated) {
    // Honor a `?next=` query param if the caller passed one (e.g. a deep
    // link from an email). Otherwise send the user to their role-aware
    // home — never assume MEMBER.
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    const fallback = ROLE_HOME[role] || '/';
    const target = next && next.startsWith('/') ? next : fallback;
    return <Navigate to={target} replace />;
  }

  return children;
}
