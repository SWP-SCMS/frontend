// Route guard: requires an authenticated user. Renders nothing until the
// AuthContext has finished its bootstrap (token + profile), to avoid
// flickering the login page on hard reloads.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    // Bootstrap in progress (silent refresh + /members/me/profile).
    // Don't render children or redirect yet — let the splash show.
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
