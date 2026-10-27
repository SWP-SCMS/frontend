// Centralized route table. Keeping routes here makes it easy to grep for
// "where is /login wired up" and to enforce the role-route pairing.

import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ROLES } from '../constants';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import RoleRoute from './RoleRoute';
import LoadingScreen from '../components/common/LoadingScreen';
import StaffLayout from '../components/layout/StaffLayout';
import MemberLayout from '../components/layout/MemberLayout';
import MemberBenefitRouteGuard from '../components/layout/MemberBenefitRouteGuard';
import CoachLayout from '../components/layout/CoachLayout';
import { APP_SHELL_NAV_ITEMS, STAFF_LABELS } from '../components/layout/navConfig';
import { useAuth } from '../context/useAuth';

// Public pages
const HomePage = lazy(() => import('../pages/public/home/HomePage'));
const LoginPage = lazy(() => import('../pages/public/login/LoginPage'));
const RegisterPage = lazy(() => import('../pages/public/register/RegisterPage'));
const VerifyEmailPage = lazy(() => import('../pages/public/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(
  () => import('../pages/public/auth/ForgotPasswordPage'),
);
const OfferListPage = lazy(() => import('../pages/public/offers/OfferListPage'));
const OfferDetailPage = lazy(() => import('../pages/public/offers/OfferDetailPage'));
const NotFoundPage = lazy(() => import('../pages/public/notFound/NotFoundPage'));
const ForbiddenPage = lazy(() => import('../pages/public/forbidden/ForbiddenPage'));

function StaffReceiptRoute() {
  const { role } = useAuth();
  const labels = STAFF_LABELS[role];

  return (
    <StaffLayout
      sidebarLabel={labels?.sidebarLabel}
      sidebarItems={APP_SHELL_NAV_ITEMS[role] || []}
      roleLabel={labels?.roleLabel}
    >
      {withSuspense(<ReceiptPage />)}
    </StaffLayout>
  );
}

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
const MembershipRequestsPage = lazy(
  () => import('../pages/member/memberships/MembershipRequestsPage'),
);
// Member – thanh toán gói tập (chuyển khoản SePay)
const MemberCheckoutPage = lazy(
  () => import('../pages/member/checkout/MemberCheckoutPage'),
);

// Member – View Class Schedule (US32)
const MemberClassSchedulePage = lazy(
  () => import('../pages/member/classSchedule/MemberClassSchedulePage'),
);
// Member – Đăng ký lớp (đặt / hủy lịch các buổi tập)
const ClassBookingPage = lazy(
  () => import('../pages/member/classBooking/ClassBookingPage'),
);
const MemberTrainingPlansPage = lazy(
  () => import('../pages/member/training/MemberTrainingPlansPage'),
);
const MemberTrainingResultsPage = lazy(
  () => import('../pages/member/training/MemberTrainingResultsPage'),
);
const MemberTrainingFeedbackPage = lazy(
  () => import('../pages/member/training/MemberTrainingFeedbackPage'),
);
const MemberReceiptListPage = lazy(
  () => import('../pages/member/receipts/MemberReceiptListPage'),
);
const NotificationPage = lazy(
  () => import('../pages/common/NotificationPage'),
);
const StaffProfilePage = lazy(
  () => import('../pages/common/StaffProfilePage'),
);
const StaffChangeEmailPage = lazy(
  () => import('../pages/common/StaffChangeEmailPage'),
);
const StaffChangePasswordPage = lazy(
  () => import('../pages/common/StaffChangePasswordPage'),
);

// Coach – Dashboard / Lịch phụ trách / Hồ sơ
const CoachDashboardPage = lazy(
  () => import('../pages/coach/dashboard/CoachDashboardPage'),
);
const CoachSchedulePage = lazy(
  () => import('../pages/coach/schedule/CoachSchedulePage'),
);
const CoachLeaveRequestsPage = lazy(
  () => import('../pages/coach/leave/CoachLeaveRequestsPage'),
);
const CoachSessionDetailPage = lazy(
  () => import('../pages/coach/schedule/CoachSessionDetailPage'),
);
const CoachSessionStudentsPage = lazy(
  () => import('../pages/coach/schedule/CoachSessionStudentsPage'),
);
const CoachSessionAttendancePage = lazy(
  () => import('../pages/coach/schedule/CoachSessionAttendancePage'),
);
const CoachSessionMemberTrainingPage = lazy(
  () => import('../pages/coach/schedule/CoachSessionMemberTrainingPage'),
);
const CoachProfilePage = lazy(
  () => import('../pages/coach/profile/CoachProfilePage'),
);
const CoachAssignedMemberListPage = lazy(
  () => import('../pages/coach/members/CoachAssignedMemberListPage'),
);
const CoachMemberProfilePage = lazy(
  () => import('../pages/coach/members/CoachMemberProfilePage'),
);
const CoachMemberTrainingPage = lazy(
  () => import('../pages/coach/members/CoachMemberTrainingPage'),
);

// Manager – Dashboard
const ManagerDashboardPage = lazy(
  () => import('../pages/manager/dashboard/ManagerDashboardPage'),
);
const MembershipRequestReviewPage = lazy(
  () => import('../pages/manager/membershipRequests/MembershipRequestReviewPage'),
);
const CoachLeaveReviewPage = lazy(
  () => import('../pages/manager/coachLeave/CoachLeaveReviewPage'),
);
const ManagerReportsPage = lazy(
  () => import('../pages/manager/reports/ManagerReportsPage'),
);
const AuditHistoryPage = lazy(
  () => import('../pages/manager/audit/AuditHistoryPage'),
);
const ManagerManualActivationPage = lazy(
  () => import('../pages/manager/emailVerification/ManualActivationReviewPage'),
);

// Receptionist – Dashboard
const ReceptionistDashboardPage = lazy(
  () => import('../pages/receptionist/dashboard/ReceptionistDashboardPage'),
);
const MembershipRequestDeskPage = lazy(
  () => import('../pages/receptionist/membershipRequests/MembershipRequestDeskPage'),
);
const ReceptionManualActivationPage = lazy(
  () => import('../pages/receptionist/emailVerification/ManualActivationPage'),
);

// Receptionist – Center Check-in (US36)
const ReceptionCenterCheckInPage = lazy(
  () => import('../pages/receptionist/checkIn/ReceptionCenterCheckInPage'),
);
const OpenCenterVisitsPage = lazy(
  () => import('../pages/receptionist/centerVisits/OpenCenterVisitsPage'),
);

// Receptionist – Member search & profile (US11)
const ReceptionistMemberListPage = lazy(
  () => import('../pages/receptionist/members/MemberListPage'),
);
const ReceptionistMemberDetailPage = lazy(
  () => import('../pages/receptionist/members/MemberDetailPage'),
);
const ReceptionistMemberBookingPage = lazy(
  () =>
    import(
      '../pages/receptionist/bookings/ReceptionistMemberBookingPage'
    ),
);

// Receptionist – Create a Member (US15)
const ReceptionistMemberCreatePage = lazy(
  () => import('../pages/receptionist/members/MemberCreatePage'),
);

// Receptionist – Membership Offer browsing (US12)
const ReceptionistMembershipOfferListPage = lazy(
  () => import('../pages/receptionist/membershipOffers/MembershipOfferListPage'),
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

// Manager – dynamic membership plan and benefit management
const MembershipPlanListPage = lazy(
  () => import('../pages/manager/membershipPlans/MembershipPlanListPage'),
);
const MembershipPlanCreatePage = lazy(
  () => import('../pages/manager/membershipPlans/MembershipPlanCreatePage'),
);
const MembershipPlanDetailPage = lazy(
  () => import('../pages/manager/membershipPlans/MembershipPlanDetailPage'),
);
const MembershipPlanEditPage = lazy(
  () => import('../pages/manager/membershipPlans/MembershipPlanEditPage'),
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
const CoachAssignmentQueuePage = lazy(
  () => import('../pages/manager/coachAssignments/CoachAssignmentQueuePage'),
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
const RoomImpactPage = lazy(
  () => import('../pages/manager/rooms/RoomImpactPage'),
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
const RefundRequestDeskPage = lazy(
  () => import('../pages/receptionist/refunds/RefundRequestDeskPage'),
);
const RefundReviewPage = lazy(
  () => import('../pages/manager/refunds/RefundReviewPage'),
);

// Printable receipt (US20 follow-up). The backend authorises
// GET /receipts/* is narrowed per receipt: MANAGER may read any;
// RECEPTIONIST may read only receipts processed by that same account.
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
      <Route
        path="/verify-email"
        element={<GuestRoute>{withSuspense(<VerifyEmailPage />)}</GuestRoute>}
      />
      <Route
        path="/forgot-password"
        element={<GuestRoute>{withSuspense(<ForgotPasswordPage />)}</GuestRoute>}
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
        path="/member/checkout/:offerId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                {withSuspense(<MemberCheckoutPage />)}
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
        path="/member/membership-requests"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                {withSuspense(<MembershipRequestsPage />)}
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
        path="/member/profile/email"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                {withSuspense(<StaffChangeEmailPage />)}
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
                <MemberBenefitRouteGuard
                  benefitCode="CLASS_BOOKING"
                  serviceName="Đăng ký lớp"
                >
                  {withSuspense(<ClassBookingPage />)}
                </MemberBenefitRouteGuard>
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
                <MemberBenefitRouteGuard
                  benefitCode="CLASS_BOOKING"
                  serviceName="Lịch lớp của tôi"
                >
                  <MemberClassSchedulePage />
                </MemberBenefitRouteGuard>
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member/pt-booking"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.MEMBER}>
              <MemberLayout>
                <MemberBenefitRouteGuard
                  benefitCode="PERSONAL_COACHING"
                  serviceName="Đặt lịch PT 1-1"
                >
                  {withSuspense(<ClassBookingPage ptOnly />)}
                </MemberBenefitRouteGuard>
              </MemberLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/member/training-plans" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout><MemberBenefitRouteGuard benefitCode="TRAINING_PLAN" serviceName="Giáo án tập luyện">{withSuspense(<MemberTrainingPlansPage />)}</MemberBenefitRouteGuard></MemberLayout></RoleRoute></ProtectedRoute>} />
      <Route path="/member/training-results" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout><MemberBenefitRouteGuard benefitCode="TRAINING_RESULT" serviceName="Kết quả tập luyện">{withSuspense(<MemberTrainingResultsPage />)}</MemberBenefitRouteGuard></MemberLayout></RoleRoute></ProtectedRoute>} />
      <Route path="/member/feedback" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout><MemberBenefitRouteGuard benefitCode="TRAINING_FEEDBACK" serviceName="Nhận xét huấn luyện viên">{withSuspense(<MemberTrainingFeedbackPage />)}</MemberBenefitRouteGuard></MemberLayout></RoleRoute></ProtectedRoute>} />
      <Route path="/member/receipts" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout>{withSuspense(<MemberReceiptListPage />)}</MemberLayout></RoleRoute></ProtectedRoute>} />
      <Route path="/member/receipts/:receiptId" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout>{withSuspense(<ReceiptPage memberMode />)}</MemberLayout></RoleRoute></ProtectedRoute>} />
      <Route path="/member/notifications" element={<ProtectedRoute><RoleRoute allow={ROLES.MEMBER}><MemberLayout>{withSuspense(<NotificationPage />)}</MemberLayout></RoleRoute></ProtectedRoute>} />

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
        <Route index element={<Navigate to="/reception/check-in" replace />} />
        <Route path="check-in" element={withSuspense(<ReceptionCenterCheckInPage />)} />
        <Route path="center-visits" element={withSuspense(<OpenCenterVisitsPage />)} />
        <Route path="dashboard" element={withSuspense(<ReceptionistDashboardPage />)} />
        <Route path="notifications" element={withSuspense(<NotificationPage />)} />
        <Route path="profile" element={withSuspense(<StaffProfilePage />)} />
        <Route path="profile/email" element={withSuspense(<StaffChangeEmailPage />)} />
        <Route path="profile/password" element={withSuspense(<StaffChangePasswordPage />)} />
        <Route path="members" element={withSuspense(<ReceptionistMemberListPage />)} />
        <Route path="members/new" element={withSuspense(<ReceptionistMemberCreatePage />)} />
        <Route path="email-verification" element={withSuspense(<ReceptionManualActivationPage />)} />
        <Route
          path="members/:memberId/bookings"
          element={withSuspense(<ReceptionistMemberBookingPage />)}
        />
        <Route path="members/:memberId" element={withSuspense(<ReceptionistMemberDetailPage />)} />
        <Route path="membership-offers" element={withSuspense(<ReceptionistMembershipOfferListPage />)} />
        <Route path="membership-requests" element={withSuspense(<MembershipRequestDeskPage />)} />
        <Route path="orders/new" element={withSuspense(<CashPaymentPage />)} />
        <Route path="payments/reconcile" element={withSuspense(<PaymentReconciliationPage />)} />
        <Route path="payments/cash" element={withSuspense(<CashPaymentPage />)} />
        <Route path="refunds" element={withSuspense(<RefundRequestDeskPage />)} />
      </Route>

      {/* Receipt view/print. Route permits Receptionist and Manager; backend
          still restricts each receptionist to receipts they processed. */}
      <Route
        path="/receipts/:receiptId"
        element={
          <ProtectedRoute>
            <RoleRoute allow={[ROLES.RECEPTIONIST, ROLES.MANAGER]}>
              <StaffReceiptRoute />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* ---------- Coach ----------
       * CoachLayout (không chuông thông báo, logo không bấm được) được mount
       * một lần ở route cha; các trang con hiển thị qua <Outlet />. */}
      <Route
        path="/coach"
        element={
          <ProtectedRoute>
            <RoleRoute allow={ROLES.COACH}>
              <CoachLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/coach/dashboard" replace />} />
        <Route path="dashboard" element={withSuspense(<CoachDashboardPage />)} />
        <Route path="schedule" element={withSuspense(<CoachSchedulePage />)} />
        <Route path="leave-requests" element={withSuspense(<CoachLeaveRequestsPage />)} />
        <Route
          path="schedule/:sessionId"
          element={withSuspense(<CoachSessionDetailPage />)}
        />
        <Route
          path="schedule/:sessionId/students"
          element={withSuspense(<CoachSessionStudentsPage />)}
        />
        <Route
          path="schedule/:sessionId/attendance"
          element={withSuspense(<CoachSessionAttendancePage />)}
        />
        <Route
          path="schedule/:sessionId/members/:memberAccountId/training"
          element={withSuspense(<CoachSessionMemberTrainingPage />)}
        />
        <Route path="profile" element={withSuspense(<CoachProfilePage />)} />
        <Route path="profile/email" element={withSuspense(<StaffChangeEmailPage />)} />
        <Route path="profile/password" element={withSuspense(<StaffChangePasswordPage />)} />
        <Route path="members" element={withSuspense(<CoachAssignedMemberListPage />)} />
        <Route path="members/:memberAccountId" element={withSuspense(<CoachMemberProfilePage />)} />
        <Route path="members/:memberAccountId/training-plans" element={withSuspense(<CoachMemberTrainingPage kind="plans" />)} />
        <Route path="members/:memberAccountId/training-results" element={withSuspense(<CoachMemberTrainingPage kind="results" />)} />
        <Route path="members/:memberAccountId/feedback" element={withSuspense(<CoachMemberTrainingPage kind="feedback" />)} />
        <Route path="notifications" element={withSuspense(<NotificationPage />)} />
      </Route>

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
        <Route path="membership-requests" element={withSuspense(<MembershipRequestReviewPage />)} />
        <Route path="coach-leave-requests" element={withSuspense(<CoachLeaveReviewPage />)} />
        <Route path="membership-offers/new" element={withSuspense(<MembershipOfferCreatePage />)} />
        <Route path="membership-offers/:offerId" element={withSuspense(<MembershipOfferDetailPage />)} />
        <Route path="membership-offers/:offerId/edit" element={withSuspense(<MembershipOfferEditPage />)} />
        <Route path="membership-plans" element={withSuspense(<MembershipPlanListPage />)} />
        <Route path="membership-plans/new" element={withSuspense(<MembershipPlanCreatePage />)} />
        <Route path="membership-plans/:planCode" element={withSuspense(<MembershipPlanDetailPage />)} />
        <Route path="membership-plans/:planCode/edit" element={withSuspense(<MembershipPlanEditPage />)} />
        <Route path="members" element={withSuspense(<MemberAccountListPage />)} />
        <Route path="coach-assignments" element={withSuspense(<CoachAssignmentQueuePage />)} />
        <Route path="email-verification" element={withSuspense(<ManagerManualActivationPage />)} />
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
        <Route path="rooms/:roomId/impact" element={withSuspense(<RoomImpactPage />)} />
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
        <Route path="reports" element={withSuspense(<ManagerReportsPage />)} />
        <Route path="reports/revenue" element={withSuspense(<RevenueReportPage />)} />
        <Route path="audit-events" element={withSuspense(<AuditHistoryPage />)} />
        <Route path="notifications" element={withSuspense(<NotificationPage />)} />
        <Route path="profile" element={withSuspense(<StaffProfilePage />)} />
        <Route path="profile/email" element={withSuspense(<StaffChangeEmailPage />)} />
        <Route path="profile/password" element={withSuspense(<StaffChangePasswordPage />)} />
        <Route path="payments/reconcile" element={withSuspense(<PaymentReconciliationPage />)} />
        <Route path="refunds" element={withSuspense(<RefundReviewPage />)} />
      </Route>

      {/* ---------- Catch-all ---------- */}
      <Route
        path="/forbidden"
        element={<ProtectedRoute>{withSuspense(<ForbiddenPage />)}</ProtectedRoute>}
      />
      <Route path="*" element={withSuspense(<NotFoundPage />)} />
    </Routes>
  );
}
