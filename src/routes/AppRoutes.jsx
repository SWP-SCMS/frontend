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
const MembershipHistoryPage = lazy(
  () => import('../pages/member/Memberships/MembershipHistoryPage'),
);
const MyPlanPage = lazy(() => import('../pages/member/Memberships/MyPlanPage'));

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

// Manager – Dashboard
const ManagerDashboardPage = lazy(
  () => import('../pages/manager/Dashboard/ManagerDashboardPage'),
);

// Receptionist – Dashboard
const ReceptionistDashboardPage = lazy(
  () => import('../pages/receptionist/Dashboard/ReceptionistDashboardPage'),
);

// Receptionist – Member search & profile (US11)
const ReceptionistMemberListPage = lazy(
  () => import('../pages/receptionist/Members/MemberListPage'),
);
const ReceptionistMemberDetailPage = lazy(
  () => import('../pages/receptionist/Members/MemberDetailPage'),
);

// Receptionist – Create a Member (US15)
const ReceptionistMemberCreatePage = lazy(
  () => import('../pages/receptionist/Members/MemberCreatePage'),
);

// Receptionist – Membership Offer browsing (US12)
const ReceptionistMembershipOfferListPage = lazy(
  () => import('../pages/receptionist/MembershipOffers/MembershipOfferListPage'),
);

// Receptionist – Bank-transfer Membership Order (US16)
const ReceptionistMembershipOrderCreatePage = lazy(
  () => import('../pages/receptionist/Orders/MembershipOrderCreatePage'),
);

// Manager – Staff/Manager account management (US05-08)
const StaffAccountListPage = lazy(
  () => import('../pages/manager/StaffAccounts/StaffAccountListPage'),
);
const StaffAccountCreatePage = lazy(
  () => import('../pages/manager/StaffAccounts/StaffAccountCreatePage'),
);
const StaffAccountDetailPage = lazy(
  () => import('../pages/manager/StaffAccounts/StaffAccountDetailPage'),
);
const StaffAccountEditPage = lazy(
  () => import('../pages/manager/StaffAccounts/StaffAccountEditPage'),
);

// Manager – Membership Offer management (US08)
const MembershipOfferListPage = lazy(
  () => import('../pages/manager/MembershipOffers/MembershipOfferListPage'),
);
const MembershipOfferCreatePage = lazy(
  () =>
    import(
      '../pages/manager/MembershipOffers/MembershipOfferCreatePage'
    ),
);
const MembershipOfferDetailPage = lazy(
  () =>
    import(
      '../pages/manager/MembershipOffers/MembershipOfferDetailPage'
    ),
);
const MembershipOfferEditPage = lazy(
  () =>
    import(
      '../pages/manager/MembershipOffers/MembershipOfferEditPage'
    ),
);

// Manager – Revenue / Membership report (US22)
const RevenueReportPage = lazy(
  () => import('../pages/manager/Reports/RevenueReportPage'),
);

// Manager – Member account management (US06)
const MemberAccountListPage = lazy(
  () => import('../pages/manager/Members/MemberAccountListPage'),
);
const MemberAccountDetailPage = lazy(
  () => import('../pages/manager/Members/MemberAccountDetailPage'),
);
const MemberAccountEditPage = lazy(
  () => import('../pages/manager/Members/MemberAccountEditPage'),
);

// Receptionist / Manager – Manual Payment Reconciliation (US19)
// Shared by both roles: the backend authorises `/payments/**` with
// hasAnyRole("MANAGER", "RECEPTIONIST").
const PaymentReconciliationPage = lazy(
  () => import('../pages/receptionist/Payments/PaymentReconciliationPage'),
);

const CashPaymentPage = lazy(
  () => import('../pages/receptionist/Payments/CashPaymentPage'),
);

// Printable receipt (US20 follow-up). The backend authorises
// GET /receipts/* for any active staff account and then narrows per
// receipt inside the service: a COACH is refused, a MEMBER may only read
// their own, and a RECEPTIONIST or MANAGER may read any (backend commit
// 4012273 removed the CASH-only limit that used to apply to receptionists).
// The page explains a 403 rather than showing a bare error, because the
// remaining causes need different responses.
const ReceiptPage = lazy(
  () => import('../pages/receptionist/Payments/ReceiptPage'),
);

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
        path="/member/memberships"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MembershipHistoryPage />
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/plan"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MyPlanPage />
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

      {/* ---------- Receptionist ---------- */}
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <Navigate to="/reception/dashboard" replace />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistDashboardPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/members"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistMemberListPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/members/new"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistMemberCreatePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/members/:memberId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistMemberDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/membership-offers"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistMembershipOfferListPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception/orders/new"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <ReceptionistMembershipOrderCreatePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reception/payments/reconcile"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <PaymentReconciliationPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* US20 – cash payment at the front desk. RECEPTIONIST only: the
          backend guards the endpoint with ensure(actor, RECEPTIONIST),
          so a Manager would get 403. */}
      <Route
        path="/reception/payments/cash"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <AppShell>
                <CashPaymentPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Receipt view/print. Deliberately allows RECEPTIONIST *and* MANAGER:
          since backend commit 4012273 a receptionist may read any receipt,
          including bank-transfer ones, and a coach is refused inside the
          service. COACH is left out of this route so a coach is redirected
          home rather than shown a page that could only ever 403. */}
      <Route
        path="/receipts/:receiptId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={[ROLES.RECEPTIONIST, ROLES.MANAGER]}>
              <AppShell>
                <ReceiptPage />
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

      {/* ---------- Manager ---------- */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <Navigate to="/manager/dashboard" replace />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <ManagerDashboardPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/staff-accounts"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <StaffAccountListPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/staff-accounts/new"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <StaffAccountCreatePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/staff-accounts/:accountId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <StaffAccountDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/staff-accounts/:accountId/edit"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <StaffAccountEditPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/membership-offers"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MembershipOfferListPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/membership-offers/new"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MembershipOfferCreatePage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/membership-offers/:offerId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MembershipOfferDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/membership-offers/:offerId/edit"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MembershipOfferEditPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/members"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MemberAccountListPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/members/:accountId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MemberAccountDetailPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/members/:accountId/edit"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <MemberAccountEditPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/reports"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <RevenueReportPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/payments/reconcile"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <AppShell>
                <PaymentReconciliationPage />
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
