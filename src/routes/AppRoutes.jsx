// Centralized route table. Keeping routes here makes it easy to grep for
// "where is /login wired up" and to enforce the role-route pairing.

import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ROLES } from '../constants';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import RoleRoute from './RoleRoute';
import LoadingScreen from '../components/common/LoadingScreen';
import AppShell from '../components/layout/AppShell';
import StaffLayout from '../components/layout/StaffLayout';
import MemberLayout from '../components/layout/MemberLayout';
import PlusOnlyGate from '../components/layout/PlusOnlyGate';
import { APP_SHELL_NAV_ITEMS, STAFF_LABELS } from '../components/layout/navConfig';

// Public pages
const HomePage = lazy(() => import('../pages/public/home/HomePage'));
const LoginPage = lazy(() => import('../pages/public/login/LoginPage'));
const RegisterPage = lazy(() => import('../pages/public/register/RegisterPage'));
const OfferListPage = lazy(() => import('../pages/public/offers/OfferListPage'));
const OfferDetailPage = lazy(() => import('../pages/public/offers/OfferDetailPage'));
const NotFoundPage = lazy(() => import('../pages/public/notFound/NotFoundPage'));

// Member-only
const MemberDashboardPage = lazy(
  () => import('../pages/member/dashboard/MemberDashboardPage'),
);
const MemberProfilePage = lazy(
  () => import('../pages/member/profile/MemberProfilePage'),
);
const MemberChangePasswordPage = lazy(
  () => import('../pages/member/profile/MemberChangePasswordPage'),
);
const MembershipHistoryPage = lazy(
  () => import('../pages/member/memberships/MembershipHistoryPage'),
);
const MyPlanPage = lazy(() => import('../pages/member/memberships/MyPlanPage'));

// Member – View Class Schedule (US32)
const MemberClassSchedulePage = lazy(
  () => import('../pages/member/classSchedule/MemberClassSchedulePage'),
);
// Member – Đăng ký lớp (đặt / hủy lịch các buổi tập)
const ClassBookingPage = lazy(
  () => import('../pages/member/classBooking/ClassBookingPage'),
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

// Manager – Dashboard
const ManagerDashboardPage = lazy(
  () => import('../pages/manager/dashboard/ManagerDashboardPage'),
);

// Receptionist – Dashboard
const ReceptionistDashboardPage = lazy(
  () => import('../pages/receptionist/dashboard/ReceptionistDashboardPage'),
);

// Receptionist – Member search & profile (US11)
const ReceptionistMemberListPage = lazy(
  () => import('../pages/receptionist/members/MemberListPage'),
);
const ReceptionistMemberDetailPage = lazy(
  () => import('../pages/receptionist/members/MemberDetailPage'),
);

// Receptionist – Create a Member (US15)
const ReceptionistMemberCreatePage = lazy(
  () => import('../pages/receptionist/members/MemberCreatePage'),
);

// Receptionist – Membership Offer browsing (US12)
const ReceptionistMembershipOfferListPage = lazy(
  () => import('../pages/receptionist/membershipOffers/MembershipOfferListPage'),
);

// Receptionist – Bank-transfer Membership Order (US16)
const ReceptionistMembershipOrderCreatePage = lazy(
  () => import('../pages/receptionist/orders/MembershipOrderCreatePage'),
);

// Manager – Staff/Manager account management (US05-08)
const StaffAccountListPage = lazy(
  () => import('../pages/manager/staffAccounts/StaffAccountListPage'),
);
const StaffAccountCreatePage = lazy(
  () => import('../pages/manager/staffAccounts/StaffAccountCreatePage'),
);
const StaffAccountDetailPage = lazy(
  () => import('../pages/manager/staffAccounts/StaffAccountDetailPage'),
);
const StaffAccountEditPage = lazy(
  () => import('../pages/manager/staffAccounts/StaffAccountEditPage'),
);

// Manager – Membership Offer management (US08)
const MembershipOfferListPage = lazy(
  () => import('../pages/manager/membershipOffers/MembershipOfferListPage'),
);
const MembershipOfferCreatePage = lazy(
  () =>
    import(
      '../pages/manager/membershipOffers/MembershipOfferCreatePage'
    ),
);
const MembershipOfferDetailPage = lazy(
  () =>
    import(
      '../pages/manager/membershipOffers/MembershipOfferDetailPage'
    ),
);
const MembershipOfferEditPage = lazy(
  () =>
    import(
      '../pages/manager/membershipOffers/MembershipOfferEditPage'
    ),
);

// Manager – Revenue / Membership report (US22)
const RevenueReportPage = lazy(
  () => import('../pages/manager/reports/RevenueReportPage'),
);

// Manager – Member account management (US06)
const MemberAccountListPage = lazy(
  () => import('../pages/manager/members/MemberAccountListPage'),
);
const MemberAccountDetailPage = lazy(
  () => import('../pages/manager/members/MemberAccountDetailPage'),
);
const MemberAccountEditPage = lazy(
  () => import('../pages/manager/members/MemberAccountEditPage'),
);

// Manager – Discipline management (US23)
const DisciplineListPage = lazy(
  () => import('../pages/manager/disciplines/DisciplineListPage'),
);
const DisciplineCreatePage = lazy(
  () => import('../pages/manager/disciplines/DisciplineCreatePage'),
);
const DisciplineDetailPage = lazy(
  () => import('../pages/manager/disciplines/DisciplineDetailPage'),
);
const DisciplineEditPage = lazy(
  () => import('../pages/manager/disciplines/DisciplineEditPage'),
);

// Manager – Class management (US24)
const ClassListPage = lazy(
  () => import('../pages/manager/classes/ClassListPage'),
);
const ClassCreatePage = lazy(
  () => import('../pages/manager/classes/ClassCreatePage'),
);
const ClassDetailPage = lazy(
  () => import('../pages/manager/classes/ClassDetailPage'),
);
const ClassEditPage = lazy(
  () => import('../pages/manager/classes/ClassEditPage'),
);

// Manager – Room management (US25)
const RoomListPage = lazy(
  () => import('../pages/manager/rooms/RoomListPage'),
);
const RoomCreatePage = lazy(
  () => import('../pages/manager/rooms/RoomCreatePage'),
);
const RoomDetailPage = lazy(
  () => import('../pages/manager/rooms/RoomDetailPage'),
);
const RoomEditPage = lazy(
  () => import('../pages/manager/rooms/RoomEditPage'),
);

// Manager – Recurring Schedule Creation (US26)
const RecurringScheduleCreatePage = lazy(
  () => import('../pages/manager/recurringSchedules/RecurringScheduleCreatePage'),
);

// Manager – Single Class Session Creation (US27)
const SingleSessionCreatePage = lazy(
  () => import('../pages/manager/classSessions/SingleSessionCreatePage'),
);

// Manager – Session List / Calendar (US28)
const ManagerSessionListPage = lazy(
  () => import('../pages/manager/classSessions/ManagerSessionListPage'),
);

// Manager – Session Detail (US29)
const SessionDetailPage = lazy(
  () => import('../pages/manager/classSessions/SessionDetailPage'),
);

// Manager – Update Session Coach / Room (US30)
const SessionAssignmentEditPage = lazy(
  () => import('../pages/manager/classSessions/SessionAssignmentEditPage'),
);

// Receptionist / Manager – Manual Payment Reconciliation (US19)
// Shared by both roles: the backend authorises `/payments/**` with
// hasAnyRole("MANAGER", "RECEPTIONIST").
const PaymentReconciliationPage = lazy(
  () => import('../pages/receptionist/payments/PaymentReconciliationPage'),
);

const CashPaymentPage = lazy(
  () => import('../pages/receptionist/payments/CashPaymentPage'),
);

// Printable receipt (US20 follow-up). The backend authorises
// GET /receipts/* for any active staff account and then narrows per
// receipt inside the service: a COACH is refused, a MEMBER may only read
// their own, and a RECEPTIONIST or MANAGER may read any (backend commit
// 4012273 removed the CASH-only limit that used to apply to receptionists).
// The page explains a 403 rather than showing a bare error, because the
// remaining causes need different responses.
const ReceiptPage = lazy(
  () => import('../pages/receptionist/payments/ReceiptPage'),
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
              <Navigate to="/member/dashboard" replace />
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
      <Route
        path="/member/class-booking"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <PlusOnlyGate feature="Đăng ký lớp">
                  {withSuspense(<ClassBookingPage />)}
                </PlusOnlyGate>
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/class-sessions"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <PlusOnlyGate feature="Lịch của tôi">
                  <MemberClassSchedulePage />
                </PlusOnlyGate>
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Receptionist ----------
       * Persistent dark shell across the entire Receptionist area.
       * The <StaffLayout> is mounted once by the parent route, and every
       * child route renders its page through the parent's <Outlet />. */}
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.RECEPTIONIST}>
              <StaffLayout
                sidebarLabel={STAFF_LABELS[ROLES.RECEPTIONIST].sidebarLabel}
                sidebarItems={APP_SHELL_NAV_ITEMS[ROLES.RECEPTIONIST]}
                roleLabel={STAFF_LABELS[ROLES.RECEPTIONIST].roleLabel}
              >
                <Outlet />
              </StaffLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/reception/dashboard" replace />} />
        <Route path="dashboard" element={withSuspense(<ReceptionistDashboardPage />)} />
        <Route path="members" element={withSuspense(<ReceptionistMemberListPage />)} />
        <Route path="members/new" element={withSuspense(<ReceptionistMemberCreatePage />)} />
        <Route path="members/:memberId" element={withSuspense(<ReceptionistMemberDetailPage />)} />
        <Route path="membership-offers" element={withSuspense(<ReceptionistMembershipOfferListPage />)} />
        <Route path="orders/new" element={withSuspense(<ReceptionistMembershipOrderCreatePage />)} />
        <Route path="payments/reconcile" element={withSuspense(<PaymentReconciliationPage />)} />
        <Route path="payments/cash" element={withSuspense(<CashPaymentPage />)} />
      </Route>

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

      {/* ---------- Manager ----------
       * Persistent dark shell across the entire Manager area.
       * The <StaffLayout> is mounted once by the parent route, and every
       * child route renders its page through the parent's <Outlet />. */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MANAGER}>
              <StaffLayout
                sidebarLabel={STAFF_LABELS[ROLES.MANAGER].sidebarLabel}
                sidebarItems={APP_SHELL_NAV_ITEMS[ROLES.MANAGER]}
                roleLabel={STAFF_LABELS[ROLES.MANAGER].roleLabel}
              >
                <Outlet />
              </StaffLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="dashboard" element={withSuspense(<ManagerDashboardPage />)} />
        <Route path="staff-accounts" element={withSuspense(<StaffAccountListPage />)} />
        <Route path="staff-accounts/new" element={withSuspense(<StaffAccountCreatePage />)} />
        <Route path="staff-accounts/:accountId" element={withSuspense(<StaffAccountDetailPage />)} />
        <Route path="staff-accounts/:accountId/edit" element={withSuspense(<StaffAccountEditPage />)} />
        <Route path="membership-offers" element={withSuspense(<MembershipOfferListPage />)} />
        <Route path="membership-offers/new" element={withSuspense(<MembershipOfferCreatePage />)} />
        <Route path="membership-offers/:offerId" element={withSuspense(<MembershipOfferDetailPage />)} />
        <Route path="membership-offers/:offerId/edit" element={withSuspense(<MembershipOfferEditPage />)} />
        <Route path="members" element={withSuspense(<MemberAccountListPage />)} />
        <Route path="members/:accountId" element={withSuspense(<MemberAccountDetailPage />)} />
        <Route path="members/:accountId/edit" element={withSuspense(<MemberAccountEditPage />)} />
        <Route path="disciplines" element={withSuspense(<DisciplineListPage />)} />
        <Route path="disciplines/new" element={withSuspense(<DisciplineCreatePage />)} />
        <Route path="disciplines/:disciplineId" element={withSuspense(<DisciplineDetailPage />)} />
        <Route path="disciplines/:disciplineId/edit" element={withSuspense(<DisciplineEditPage />)} />
        <Route path="classes" element={withSuspense(<ClassListPage />)} />
        <Route path="classes/new" element={withSuspense(<ClassCreatePage />)} />
        <Route path="classes/:classId" element={withSuspense(<ClassDetailPage />)} />
        <Route path="classes/:classId/edit" element={withSuspense(<ClassEditPage />)} />
        <Route path="rooms" element={withSuspense(<RoomListPage />)} />
        <Route path="rooms/new" element={withSuspense(<RoomCreatePage />)} />
        <Route path="rooms/:roomId" element={withSuspense(<RoomDetailPage />)} />
        <Route path="rooms/:roomId/edit" element={withSuspense(<RoomEditPage />)} />
        <Route
          path="classes/:classId/recurring-schedules/new"
          element={withSuspense(<RecurringScheduleCreatePage />)}
        />
        <Route
          path="classes/:classId/sessions/new"
          element={withSuspense(<SingleSessionCreatePage />)}
        />
        <Route path="class-sessions" element={withSuspense(<ManagerSessionListPage />)} />
        <Route path="class-sessions/:sessionId" element={withSuspense(<SessionDetailPage />)} />
        <Route
          path="class-sessions/:sessionId/assignment/edit"
          element={withSuspense(<SessionAssignmentEditPage />)}
        />
        <Route path="reports" element={withSuspense(<RevenueReportPage />)} />
        <Route path="payments/reconcile" element={withSuspense(<PaymentReconciliationPage />)} />
      </Route>

      {/* ---------- Catch-all ---------- */}
      <Route path="*" element={withSuspense(<NotFoundPage />)} />
    </Routes>
  );
}
