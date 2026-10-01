// Hook for consuming the AuthContext. Kept in a separate file so that
// Fast Refresh can hot-reload the Provider component without resetting
// the hook's identity for consumers.

import { useContext } from 'react';
import { AuthContext } from './AuthContextObject';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
