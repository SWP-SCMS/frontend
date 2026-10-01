// Role guard: requires the authenticated user to have one of the allowed
// roles. Backend remains the source of truth for authorization — this
// component is purely for routing/UX (don't show a manager screen to a
// member). Always pair with <ProtectedRoute /> as the outer guard.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function RoleRoute({ allow, children }) {
  const { isAuthenticated, isReady, role } = useAuth();
  const location = useLocation();

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(role)) {
    // Authenticated but wrong role -> send to a role-appropriate home.
    return <Navigate to="/" replace />;
  }

  return children;
}
