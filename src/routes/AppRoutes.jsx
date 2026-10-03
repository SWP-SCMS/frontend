// Centralized route table. Keeping routes here makes it easy to grep for
// "where is /login wired up" and to enforce the role-route pairing.

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ROLES } from '../constants';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import RoleRoute from './RoleRoute';
import LoadingScreen from '../components/common/LoadingScreen';
import AppShell from '../components/layout/AppShell';
import MemberLayout from '../components/layout/MemberLayout';

// Public pages
const HomePage = lazy(() => import('../pages/public/Home/HomePage'));
const LoginPage = lazy(() => import('../pages/public/Login/LoginPage'));
const RegisterPage = lazy(() => import('../pages/public/Register/RegisterPage'));
const OfferListPage = lazy(() => import('../pages/public/Offers/OfferListPage'));
const OfferDetailPage = lazy(() => import('../pages/public/Offers/OfferDetailPage'));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage'));

// Member-only
const MemberDashboardPage = lazy(
  () => import('../pages/member/Dashboard/MemberDashboardPage'),
);
const MemberProfilePage = lazy(
  () => import('../pages/member/Profile/MemberProfilePage'),
);
const MemberChangePasswordPage = lazy(
  () => import('../pages/member/Profile/MemberChangePasswordPage'),
);

// Placeholders for phases that don't have full UI yet — kept as stubs so
// navigation doesn't 404 during development of later phases.
function ComingSoon({ feature }) {
  return (
    <div className="container py-5">
      <h2 className="mb-2">Sắp ra mắt</h2>
      <p className="text-muted mb-0">{feature}</p>
    </div>
  );
}

function withSuspense(node) {
  return <Suspense fallback={<LoadingScreen />}>{node}</Suspense>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ---------- Public ---------- */}
      <Route path="/" element={withSuspense(<HomePage />)} />
      <Route
        path="/login"
        element={
          <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>{withSuspense(<RegisterPage />)}</GuestRoute>
        }
      />
      <Route path="/offers" element={withSuspense(<OfferListPage />)} />
      <Route
        path="/offers/:offerId"
        element={withSuspense(<OfferDetailPage />)}
      />

      {/* ---------- Member ---------- */}
      <Route
        path="/member"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <AppShell>
                <Navigate to="/member/dashboard" replace />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MemberDashboardPage />
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/profile"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MemberProfilePage />
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/profile/password"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MemberChangePasswordPage />
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Receptionist (Phase 4 stubs) ---------- */}
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ComingSoon feature="Receptionist Dashboard — Phase 4" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Coach (Phase 6 stubs) ---------- */}
      <Route
        path="/coach"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.COACH}>
              <AppShell>
                <ComingSoon feature="Coach Dashboard — Phase 6" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Manager (Phase 5 stubs) ---------- */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <ComingSoon feature="Manager Dashboard — Phase 5" />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Catch-all ---------- */}
      <Route path="*" element={withSuspense(<NotFoundPage />)} />
    </Routes>
  );
}
