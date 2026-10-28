import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import { ACCOUNT_STATUS } from '../../../constants';
import {
  cancelReceptionMemberBooking,
  createReceptionMemberBooking,
  listReceptionClassSessions,
  listReceptionMemberBookings,
} from '../../../services/receptionistBookingService';
import { listReceptionPtSessions } from '../../../services/ptSessionService';
import {
  joinReceptionMemberWaitlist,
  leaveReceptionMemberWaitlist,
  listReceptionSessionWaitlist,
} from '../../../services/waitlistService';
import { getReceptionMemberProfile } from '../../../services/receptionistService';
import { getReceptionMemberMemberships } from '../../../services/staffMembershipService';
import {
  formatGymDate,
  formatGymTime,
  getGymLocalIsoDate,
  getGymZoneTodayIsoDate,
  gymEndOfDayIsoInstant,
  gymLocalDateToIsoInstant,
  ISO_DATE_RE,
} from '../../../utils/gymTime';
import {
  findMissingBenefitCodes,
  formatBenefitCodeList,
  hasBenefitContract,
  normalizeBenefitCodes,
} from '../../../utils/membershipBenefits';

const HISTORY_PAGE_SIZE = 10;
const SESSION_PAGE_SIZE = 20;
const CANCELLATION_WINDOW_MS = 2 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
};

const BOOKING_STATUS_LABEL = {
  BOOKED: 'Đã đặt',
  CANCELLED: 'Đã hủy',
};

const CANCELLATION_SOURCE_LABEL = {
  MEMBER: 'Hội viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  SYSTEM: 'Hệ thống',
  MEMBER_SUSPENDED: 'Hệ thống (hội viên bị tạm khóa)',
  SESSION_CANCELLED: 'Hệ thống (buổi tập bị hủy)',
};

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
};

const BOOKING_ERROR_MESSAGES = {
  MEMBERSHIP_FROZEN: 'Gói tập của hội viên đang được đóng băng nên chưa thể đặt buổi tập.',
  VALIDATION_ERROR: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
  MALFORMED_REQUEST: 'Yêu cầu đặt lịch không đúng định dạng.',
  BOOKING_ACTOR_NOT_ACTIVE_RECEPTIONIST:
    'Tài khoản lễ tân hiện không được phép thực hiện thao tác này.',
  SESSION_NOT_FOUND: 'Buổi tập không còn tồn tại.',
  BOOKING_NOT_FOUND: 'Không tìm thấy lịch đặt này.',
  MEMBER_NOT_ACTIVE:
    'Hội viên không ở trạng thái hoạt động nên không thể đặt hoặc hủy lịch.',
  SESSION_NOT_BOOKABLE:
    'Buổi tập không còn nhận đặt lịch (đã bắt đầu hoặc không còn SCHEDULED).',
  BOOKING_PLUS_MEMBERSHIP_REQUIRED:
    'Gói tập của hội viên chưa có quyền đặt lớp hoặc chưa đáp ứng quyền lợi của bộ môn này.',
  MEMBERSHIP_BENEFIT_REQUIRED:
    'Gói tập của hội viên chưa đáp ứng quyền lợi của bộ môn này.',
  BOOKING_DUPLICATE: 'Hội viên đã đặt buổi tập này.',
  BOOKING_TIME_CONFLICT:
    'Buổi tập trùng giờ với một lịch khác mà hội viên đã đặt.',
  SESSION_FULL: 'Buổi tập đã hết chỗ.',
  BOOKING_CONFLICT:
    'Dữ liệu chỗ trống vừa thay đổi. Danh sách đã được tải lại, vui lòng thử lại.',
  BOOKING_NOT_BOOKED: 'Lịch này không còn ở trạng thái đã đặt.',
  BOOKING_CANCELLATION_WINDOW_CLOSED:
    'Chỉ được hủy lịch trước giờ bắt đầu ít nhất 2 giờ.',
  SESSION_NOT_FULL: 'Buổi tập vừa có chỗ trống. Hãy đặt lịch trực tiếp.',
  WAITLIST_DUPLICATE: 'Hội viên đã ở trong hàng chờ của buổi tập này.',
  WAITLIST_NOT_FOUND: 'Hội viên không còn ở trong hàng chờ của buổi tập này.',
  PT_COACH_ASSIGNMENT_MISMATCH:
    'Hội viên chỉ có thể đăng ký PT 1-1 với huấn luyện viên cá nhân đang được phân công.',
};

const filterSchema = z
  .object({
    fromDate: z
      .string()
      .refine((value) => value === '' || ISO_DATE_RE.test(value), 'Ngày bắt đầu không hợp lệ.'),
    toDate: z
      .string()
      .refine((value) => value === '' || ISO_DATE_RE.test(value), 'Ngày kết thúc không hợp lệ.'),
  })
  .superRefine((data, context) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      context.addIssue({
        code: 'custom',
        path: ['toDate'],
        message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
      });
    }
  });

const bookingSchema = z.object({
  sessionId: z.string().regex(UUID_RE, 'Buổi tập được chọn không hợp lệ.'),
});

function addGymDays(dateText, days) {
  const instant = gymLocalDateToIsoInstant(dateText, '12:00');
  if (!instant) return '';
  const next = new Date(new Date(instant).getTime() + days * 24 * 60 * 60 * 1000);
  return getGymLocalIsoDate(next.toISOString());
}

function defaultDateRange() {
  const fromDate = getGymZoneTodayIsoDate();
  return { fromDate, toDate: addGymDays(fromDate, 14) };
}

function dateTimeText(startTime, endTime) {
  return `${formatGymDate(startTime)} · ${formatGymTime(startTime)}–${formatGymTime(endTime)}`;
}

function instantText(instant) {
  return `${formatGymDate(instant)} · ${formatGymTime(instant)}`;
}

function classDescription(row) {
  return [row?.disciplineName, CLASS_TYPE_LABEL[row?.classType] || row?.classType]
    .filter(Boolean)
    .join(' · ');
}

function errorCode(error) {
  return error?.response?.data?.code;
}

function knownBookingError(error) {
  const code = errorCode(error);
  if (code === 'MEMBERSHIP_BENEFIT_REQUIRED') {
    const missing = formatBenefitCodeList(error?.response?.data?.missingBenefitCodes);
    return missing
      ? `Gói tập của hội viên còn thiếu quyền lợi: ${missing}.`
      : BOOKING_ERROR_MESSAGES.MEMBERSHIP_BENEFIT_REQUIRED;
  }
  return code ? BOOKING_ERROR_MESSAGES[code] : null;
}

function shouldRefreshAfterActionError(error) {
  const code = errorCode(error);
  return (
    error?.response?.status === 409 ||
    code === 'SESSION_NOT_FOUND' ||
    code === 'BOOKING_NOT_FOUND'
  );
}

function pageRows(pageData) {
  return Array.isArray(pageData?.content) ? pageData.content : [];
}

async function fetchAllReceptionSessions(loader, params) {
  const rows = [];
  let page = 0;
  for (;;) {
    const data = await loader({ ...params, page, size: 100 });
    const content = pageRows(data);
    rows.push(...content);
    if (content.length === 0 || page + 1 >= (data?.totalPages || 0)) break;
    page += 1;
  }
  return rows;
}

function PageControls({ page, totalPages, disabled, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        disabled={disabled || page <= 0}
        onClick={() => onChange(page - 1)}
      >
        Trang trước
      </Button>
      <span className="small text-muted">
        Trang {page + 1} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        disabled={disabled || page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Trang sau
      </Button>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="text-center py-5">
      <Spinner animation="border" variant="danger" />
    </div>
  );
}

export default function ReceptionistMemberBookingPage() {
  const { memberId } = useParams();
  const location = useLocation();
  const initialRange = useMemo(() => defaultDateRange(), []);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsError, setMembershipsError] = useState(null);

  const [sessionsPageData, setSessionsPageData] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [sessionPage, setSessionPage] = useState(0);
  const [appliedSessionFilters, setAppliedSessionFilters] = useState(initialRange);

  const [historyPageData, setHistoryPageData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyStatus, setHistoryStatus] = useState('ALL');

  const [bookTarget, setBookTarget] = useState(null);
  const [bookModalError, setBookModalError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelModalError, setCancelModalError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [waitlistTarget, setWaitlistTarget] = useState(null);
  const [waitlistRows, setWaitlistRows] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState(null);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const profileRequestRef = useRef(0);
  const sessionsRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  const {
    register: registerFilter,
    handleSubmit: handleFilterSubmit,
    reset: resetFilters,
    formState: { errors: filterErrors },
  } = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: initialRange,
  });

  const {
    register: registerBooking,
    handleSubmit: handleBookingSubmit,
    reset: resetBooking,
    setError: setBookingFieldError,
    formState: { errors: bookingErrors, isSubmitting: bookingSubmitting },
  } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { sessionId: '' },
  });

  const accountId = profile?.accountId;
  const mutationsAllowed = profile?.status === ACCOUNT_STATUS.ACTIVE;
  const sessions = pageRows(sessionsPageData);
  const historyRows = pageRows(historyPageData);
  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.status === 'ACTIVE') || null,
    [memberships],
  );
  const membershipBenefitsKnown =
    !membershipsLoading &&
    !membershipsError &&
    (activeMembership == null || hasBenefitContract(activeMembership));
  const ownedBenefitCodes = normalizeBenefitCodes(
    activeMembership?.benefitCodes ?? activeMembership?.benefit_codes,
  );

  const requestedBackPath = location.state?.from;
  const safeBackPath =
    typeof requestedBackPath === 'string' &&
    requestedBackPath.startsWith('/reception/members') &&
    !requestedBackPath.includes('/bookings')
      ? requestedBackPath
      : `/reception/members/${memberId}`;

  const loadProfile = useCallback(async () => {
    const requestId = ++profileRequestRef.current;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await getReceptionMemberProfile(memberId);
      if (requestId === profileRequestRef.current) setProfile(data);
    } catch (error) {
      if (requestId === profileRequestRef.current) {
        setProfile(null);
        setProfileError(error);
      }
    } finally {
      if (requestId === profileRequestRef.current) setProfileLoading(false);
    }
  }, [memberId]);

  const loadMemberships = useCallback(async () => {
    setMembershipsLoading(true);
    setMembershipsError(null);
    try {
      setMemberships(await getReceptionMemberMemberships(memberId));
    } catch (error) {
      setMemberships([]);
      setMembershipsError(error);
    } finally {
      setMembershipsLoading(false);
    }
  }, [memberId]);

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++sessionsRequestRef.current;
    if (!silent) setSessionsLoading(true);
    setSessionsError(null);
    try {
      const params = {
        from: appliedSessionFilters.fromDate
          ? gymLocalDateToIsoInstant(appliedSessionFilters.fromDate, '00:00')
          : undefined,
        to: appliedSessionFilters.toDate
          ? gymEndOfDayIsoInstant(appliedSessionFilters.toDate)
          : undefined,
      };
      const [classes, ptSessions] = await Promise.all([
        fetchAllReceptionSessions(listReceptionClassSessions, params),
        fetchAllReceptionSessions(listReceptionPtSessions, params),
      ]);
      const allRows = [
        ...new Map([...classes, ...ptSessions].map((row) => [row.id, row])).values(),
      ].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const totalPages = Math.ceil(allRows.length / SESSION_PAGE_SIZE);
      const safePage = totalPages > 0 ? Math.min(sessionPage, totalPages - 1) : 0;
      const content = allRows.slice(
        safePage * SESSION_PAGE_SIZE,
        (safePage + 1) * SESSION_PAGE_SIZE,
      );
      if (requestId === sessionsRequestRef.current) {
        if (safePage !== sessionPage) setSessionPage(safePage);
        setSessionsPageData({
          content,
          page: safePage,
          size: SESSION_PAGE_SIZE,
          totalElements: allRows.length,
          totalPages,
        });
      }
    } catch (error) {
      if (requestId === sessionsRequestRef.current) setSessionsError(error);
    } finally {
      if (requestId === sessionsRequestRef.current) setSessionsLoading(false);
    }
  }, [appliedSessionFilters, sessionPage]);

  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!accountId) return;
    const requestId = ++historyRequestRef.current;
    if (!silent) setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await listReceptionMemberBookings(accountId, {
        status: historyStatus === 'ALL' ? undefined : historyStatus,
        page: historyPage,
        size: HISTORY_PAGE_SIZE,
      });
      if (requestId === historyRequestRef.current) setHistoryPageData(data);
    } catch (error) {
      if (requestId === historyRequestRef.current) setHistoryError(error);
    } finally {
      if (requestId === historyRequestRef.current) setHistoryLoading(false);
    }
  }, [accountId, historyPage, historyStatus]);

  useEffect(() => {
    setProfile(null);
    setNotice(null);
    loadProfile();
    loadMemberships();
  }, [loadMemberships, loadProfile]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (accountId) loadHistory();
  }, [accountId, loadHistory]);

  const refreshBookingData = useCallback(async () => {
    if (!accountId) return;
    await Promise.all([
      loadSessions({ silent: true }),
      loadHistory({ silent: true }),
    ]);
  }, [accountId, loadSessions, loadHistory]);
  useAutoRefresh(
    refreshBookingData,
    30_000,
    Boolean(accountId) && !bookTarget && !cancelTarget && !waitlistTarget && !busyId && !waitlistSubmitting,
  );

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  function applyFilters(data) {
    setAppliedSessionFilters(data);
    setSessionPage(0);
  }

  function clearFilters() {
    const defaults = defaultDateRange();
    resetFilters(defaults);
    setAppliedSessionFilters(defaults);
    setSessionPage(0);
  }

  function changeHistoryStatus(status) {
    setHistoryStatus(status);
    setHistoryPage(0);
  }

  function openBookModal(session) {
    setNotice(null);
    setActionError(null);
    setBookModalError(null);
    resetBooking({ sessionId: session.id });
    setBookTarget(session);
  }

  function closeBookModal() {
    if (bookingSubmitting) return;
    setBookTarget(null);
    setBookModalError(null);
    resetBooking({ sessionId: '' });
  }

  async function refreshAuthoritativeData() {
    await Promise.allSettled([
      loadHistory({ silent: true }),
      loadSessions({ silent: true }),
    ]);
  }

  async function createBooking(data) {
    if (!accountId || !bookTarget || !mutationsAllowed) return;
    setBookModalError(null);
    setActionError(null);
    setNotice(null);
    try {
      await createReceptionMemberBooking(accountId, { sessionId: data.sessionId });
      const bookedClass = bookTarget.className || 'buổi tập';
      setBookTarget(null);
      resetBooking({ sessionId: '' });
      setNotice(`Đã đặt ${bookedClass} cho hội viên ${profile.memberId}.`);
      await refreshAuthoritativeData();
    } catch (error) {
      if (error?.response?.status === 401) return;
      const code = errorCode(error);
      const message = knownBookingError(error);
      if (code === 'VALIDATION_ERROR' || code === 'MALFORMED_REQUEST') {
        setBookingFieldError('sessionId', { type: 'server', message });
      } else if (message) {
        setBookModalError(message);
      } else {
        setActionError(error);
        setBookTarget(null);
      }
      if (shouldRefreshAfterActionError(error)) await refreshAuthoritativeData();
    }
  }

  function submitBooking(event) {
    return handleBookingSubmit(createBooking)(event);
  }

  function openCancelModal(booking) {
    setNotice(null);
    setActionError(null);
    setCancelModalError(null);
    setCancelTarget(booking);
  }

  function closeCancelModal() {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelModalError(null);
  }

  async function confirmCancel() {
    if (!accountId || !cancelTarget || !mutationsAllowed) return;
    setCancelling(true);
    setCancelModalError(null);
    setActionError(null);
    setNotice(null);
    try {
      await cancelReceptionMemberBooking(accountId, cancelTarget.bookingId);
      const cancelledClass = cancelTarget.className || 'buổi tập';
      setCancelTarget(null);
      setNotice(`Đã hủy ${cancelledClass} cho hội viên ${profile.memberId}.`);
      await refreshAuthoritativeData();
    } catch (error) {
      if (error?.response?.status === 401) return;
      const message = knownBookingError(error);
      if (message) {
        setCancelModalError(message);
      } else {
        setActionError(error);
        setCancelTarget(null);
      }
      if (shouldRefreshAfterActionError(error)) await refreshAuthoritativeData();
    } finally {
      setCancelling(false);
    }
  }

  async function openWaitlistModal(session) {
    setWaitlistTarget(session);
    setWaitlistRows([]);
    setWaitlistError(null);
    setWaitlistLoading(true);
    try {
      setWaitlistRows(await listReceptionSessionWaitlist(session.id));
    } catch (error) {
      setWaitlistError(error);
    } finally {
      setWaitlistLoading(false);
    }
  }

  function closeWaitlistModal() {
    if (waitlistSubmitting) return;
    setWaitlistTarget(null);
    setWaitlistRows([]);
    setWaitlistError(null);
  }

  async function toggleMemberWaitlist() {
    if (!accountId || !waitlistTarget) return;
    const waiting = waitlistRows.find(
      (entry) => entry.memberId === accountId && entry.status === 'WAITING',
    );
    setWaitlistSubmitting(true);
    setWaitlistError(null);
    try {
      if (waiting) {
        await leaveReceptionMemberWaitlist(accountId, waitlistTarget.id);
        setNotice(`Đã rời hàng chờ cho hội viên ${profile.memberId}.`);
      } else {
        await joinReceptionMemberWaitlist(accountId, waitlistTarget.id);
        setNotice(`Đã thêm hội viên ${profile.memberId} vào hàng chờ.`);
      }
      setWaitlistRows(await listReceptionSessionWaitlist(waitlistTarget.id));
      await loadSessions({ silent: true });
    } catch (error) {
      setWaitlistError({
        message: knownBookingError(error) || 'Không cập nhật được hàng chờ.',
      });
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  if (profileLoading) return <LoadingBlock />;

  if (profileError || !profile) {
    return (
      <div>
        <ErrorAlert error={profileError} title="Không tải được hồ sơ hội viên" />
        <Button as={Link} to="/reception/members" variant="outline-secondary">
          ← Quay lại tra cứu
        </Button>
      </div>
    );
  }

  return (
    <div>
      <WorkflowBreadcrumb
        items={[
          { to: '/reception/members', label: 'Hội viên' },
          { to: safeBackPath, label: profile.memberId },
        ]}
        current="Lịch đặt"
      />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1">Đặt / quản lý lịch</h1>
          <p className="text-muted mb-0">
            Chọn buổi tập, xem lịch sử và hủy lịch cho hội viên đã chọn.
          </p>
        </div>
      </header>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h5 fw-bold mb-1">{profile.fullName || 'Hội viên'}</h2>
              <div className="text-muted small">
                Mã hội viên: <span className="fw-semibold">{profile.memberId}</span>
              </div>
            </div>
            <span className={`badge ${STATUS_BADGE[profile.status] || 'bg-light text-dark'}`}>
              {profile.status || '—'}
            </span>
          </div>
          <Row className="g-3 mt-1">
            <Col sm={6} lg={4}>
              <div className="text-muted small">Số điện thoại</div>
              <div className="fw-semibold">{profile.phone || '—'}</div>
            </Col>
            <Col sm={6} lg={4}>
              <div className="text-muted small">Trạng thái tài khoản</div>
              <div className="fw-semibold">
                {mutationsAllowed ? 'Đang hoạt động' : profile.status || '—'}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {!mutationsAllowed ? (
        <Alert variant="warning">
          Hội viên đang ở trạng thái <strong>{profile.status}</strong>. Lịch sử vẫn có
          thể xem, nhưng thao tác đặt và hủy lịch đã bị khóa.
        </Alert>
      ) : null}

      {notice ? (
        <Alert variant="success" dismissible onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      <ErrorAlert
        error={actionError}
        title="Không thực hiện được thao tác"
        onClose={() => setActionError(null)}
      />

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white border-0 pt-3">
          <h2 className="h5 fw-bold mb-1">Buổi tập sắp tới</h2>
          <p className="small text-muted mb-0">
            Tất cả thời gian hiển thị theo múi giờ Asia/Ho_Chi_Minh. Điều kiện đặt lịch
            (quyền lợi gói tập, xung đột lịch và số chỗ còn lại) sẽ được hệ thống
            kiểm tra khi xác nhận.
          </p>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleFilterSubmit(applyFilters)} className="mb-3">
            <Row className="g-3 align-items-end">
              <Col md={4}>
                <Form.Group controlId="booking-from-date">
                  <Form.Label>Từ ngày</Form.Label>
                  <Form.Control
                    type="date"
                    {...registerFilter('fromDate')}
                    isInvalid={Boolean(filterErrors.fromDate)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {filterErrors.fromDate?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="booking-to-date">
                  <Form.Label>Đến ngày</Form.Label>
                  <Form.Control
                    type="date"
                    {...registerFilter('toDate')}
                    isInvalid={Boolean(filterErrors.toDate)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {filterErrors.toDate?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex gap-2">
                <Button type="submit" variant="danger" disabled={sessionsLoading}>
                  Áp dụng
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={clearFilters}
                  disabled={sessionsLoading}
                >
                  Đặt lại
                </Button>
              </Col>
            </Row>
          </Form>

          <ErrorAlert
            error={sessionsError}
            title="Không tải được danh sách buổi tập"
            onClose={() => setSessionsError(null)}
          />

          {membershipsError ? (
            <Alert variant="warning" className="py-2">
              Không tải được quyền lợi hiện tại của hội viên. Hệ thống sẽ kiểm tra lại khi xác nhận đặt lịch.
            </Alert>
          ) : null}

          {sessionsLoading ? (
            <LoadingBlock />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="Không có buổi tập phù hợp"
              message="Thử đổi khoảng ngày hoặc quay lại sau."
            />
          ) : (
            <>
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Lớp / bộ môn</th>
                    <th>Thời gian</th>
                    <th>HLV / phòng</th>
                    <th>Chỗ trống</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const full =
                      typeof session.availableCapacity === 'number' &&
                      session.availableCapacity <= 0;
                    const requiredBenefitCodes = normalizeBenefitCodes(
                      session.requiredBenefitCodes?.length
                        ? session.requiredBenefitCodes
                        : ['CLASS_BOOKING'],
                    );
                    const missingBenefitCodes = membershipBenefitsKnown
                      ? findMissingBenefitCodes(requiredBenefitCodes, ownedBenefitCodes)
                      : [];
                    const benefitBlocked =
                      membershipBenefitsKnown && missingBenefitCodes.length > 0;
                    const selectable =
                      mutationsAllowed &&
                      session.bookingAvailable === true &&
                      !full &&
                      !membershipsLoading &&
                      !benefitBlocked;
                    const waitlistSelectable =
                      mutationsAllowed &&
                      full &&
                      !membershipsLoading &&
                      !benefitBlocked;
                    let unavailableTitle;
                    if (!mutationsAllowed) {
                      unavailableTitle = 'Tài khoản hội viên không hoạt động';
                    } else if (full) {
                      unavailableTitle = 'Xem hoặc cập nhật hàng chờ';
                    } else if (membershipsLoading) {
                      unavailableTitle = 'Đang kiểm tra quyền lợi gói tập';
                    } else if (benefitBlocked) {
                      unavailableTitle = `Gói tập còn thiếu: ${formatBenefitCodeList(missingBenefitCodes)}`;
                    } else if (session.bookingAvailable !== true) {
                      unavailableTitle = 'Buổi tập không còn nhận đặt lịch';
                    }
                    return (
                      <tr key={session.id}>
                        <td>
                          <div className="fw-semibold">{session.className || '—'}</div>
                          <div className="small text-muted">
                            {classDescription(session) || '—'}
                          </div>
                          <div className="small text-muted">
                            Yêu cầu: {formatBenefitCodeList(requiredBenefitCodes)}
                          </div>
                        </td>
                        <td className="text-nowrap">
                          {dateTimeText(session.startTime, session.endTime)}
                        </td>
                        <td>
                          <div>{session.coachName || '—'}</div>
                          <div className="small text-muted">{session.roomName || '—'}</div>
                        </td>
                        <td className="text-nowrap">
                          <div className={full ? 'text-danger fw-semibold' : ''}>
                            {session.availableCapacity ?? '—'} / {session.capacity ?? '—'}
                          </div>
                          <div className="small text-muted">
                            Đã đặt: {session.bookedCount ?? '—'}
                          </div>
                        </td>
                        <td className="text-end">
                          <Button
                            type="button"
                            variant={selectable || waitlistSelectable ? 'danger' : 'outline-secondary'}
                            size="sm"
                            disabled={full ? !waitlistSelectable : !selectable}
                            onClick={() =>
                              full
                                ? openWaitlistModal(session)
                                : openBookModal(session)
                            }
                            title={unavailableTitle}
                          >
                            {full
                              ? 'Xem hàng chờ'
                              : membershipsLoading
                                ? 'Đang kiểm tra'
                              : benefitBlocked
                                ? 'Thiếu quyền lợi'
                              : session.bookingAvailable === true
                                ? 'Chọn buổi tập'
                                : 'Không thể đặt'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <PageControls
                page={sessionPage}
                totalPages={sessionsPageData?.totalPages || 0}
                disabled={sessionsLoading}
                onChange={setSessionPage}
              />
            </>
          )}
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0 pt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h2 className="h5 fw-bold mb-1">Lịch sử đặt lịch</h2>
              <p className="small text-muted mb-0">Bao gồm lịch đang giữ chỗ và lịch đã hủy.</p>
            </div>
            <div className="btn-group" role="group" aria-label="Lọc trạng thái đặt lịch">
              {[
                ['ALL', 'Tất cả'],
                ['BOOKED', 'Đã đặt'],
                ['CANCELLED', 'Đã hủy'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={historyStatus === value ? 'danger' : 'outline-danger'}
                  size="sm"
                  onClick={() => changeHistoryStatus(value)}
                  disabled={historyLoading}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <ErrorAlert
            error={historyError}
            title="Không tải được lịch sử đặt lịch"
            onClose={() => setHistoryError(null)}
          />
          {historyLoading ? (
            <LoadingBlock />
          ) : historyRows.length === 0 ? (
            <EmptyState
              title="Chưa có lịch đặt"
              message={
                historyStatus === 'ALL'
                  ? 'Hội viên chưa có lịch đặt nào.'
                  : 'Không có lịch ở trạng thái đã chọn.'
              }
            />
          ) : (
            <>
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Lớp / bộ môn</th>
                    <th>Buổi tập</th>
                    <th>HLV / phòng</th>
                    <th>Trạng thái</th>
                    <th>Thời điểm xử lý</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((booking) => {
                    const canCancelByTime =
                      new Date(booking.startTime).getTime() - nowMs >=
                      CANCELLATION_WINDOW_MS;
                    const canCancel =
                      booking.status === 'BOOKED' && mutationsAllowed && canCancelByTime;
                    return (
                      <tr key={booking.bookingId}>
                        <td>
                          <div className="fw-semibold">{booking.className || '—'}</div>
                          <div className="small text-muted">
                            {classDescription(booking) || '—'}
                          </div>
                        </td>
                        <td className="text-nowrap">
                          {dateTimeText(booking.startTime, booking.endTime)}
                        </td>
                        <td>
                          <div>{booking.coachName || '—'}</div>
                          <div className="small text-muted">{booking.roomName || '—'}</div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              booking.status === 'BOOKED'
                                ? 'bg-success-subtle text-success-emphasis'
                                : 'bg-secondary-subtle text-secondary-emphasis'
                            }`}
                          >
                            {BOOKING_STATUS_LABEL[booking.status] || booking.status || '—'}
                          </span>
                        </td>
                        <td className="small">
                          <div>Đặt: {instantText(booking.bookedAt)}</div>
                          {booking.cancelledAt ? (
                            <div className="text-muted">
                              Hủy: {instantText(booking.cancelledAt)}
                              {' · '}
                              {CANCELLATION_SOURCE_LABEL[booking.cancellationSource] ||
                                booking.cancellationSource ||
                                '—'}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-end">
                          {booking.status === 'BOOKED' ? (
                            <div>
                              <Button
                                type="button"
                                variant="outline-danger"
                                size="sm"
                                disabled={!canCancel}
                                onClick={() => openCancelModal(booking)}
                              >
                                Hủy lịch
                              </Button>
                              {!canCancelByTime ? (
                                <div className="small text-muted mt-1">
                                  Cần trước giờ tập ít nhất 2 giờ
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <PageControls
                page={historyPage}
                totalPages={historyPageData?.totalPages || 0}
                disabled={historyLoading}
                onChange={setHistoryPage}
              />
            </>
          )}
        </Card.Body>
      </Card>

      <Modal show={Boolean(bookTarget)} onHide={closeBookModal} centered>
        <Form onSubmit={submitBooking}>
          <Modal.Header closeButton={!bookingSubmitting}>
            <Modal.Title className="h5">Xác nhận đặt lịch</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input type="hidden" {...registerBooking('sessionId')} />
            <dl className="row mb-0">
              <dt className="col-sm-4">Hội viên</dt>
              <dd className="col-sm-8">
                {profile.fullName || '—'} ({profile.memberId})
              </dd>
              <dt className="col-sm-4">Lớp</dt>
              <dd className="col-sm-8">{bookTarget?.className || '—'}</dd>
              <dt className="col-sm-4">Thời gian</dt>
              <dd className="col-sm-8">
                {bookTarget
                  ? dateTimeText(bookTarget.startTime, bookTarget.endTime)
                  : '—'}
              </dd>
              <dt className="col-sm-4">Huấn luyện viên</dt>
              <dd className="col-sm-8">{bookTarget?.coachName || '—'}</dd>
              <dt className="col-sm-4">Phòng</dt>
              <dd className="col-sm-8">{bookTarget?.roomName || '—'}</dd>
              <dt className="col-sm-4">Quyền lợi yêu cầu</dt>
              <dd className="col-sm-8">
                {formatBenefitCodeList(
                  bookTarget?.requiredBenefitCodes?.length
                    ? bookTarget.requiredBenefitCodes
                    : ['CLASS_BOOKING'],
                )}
              </dd>
            </dl>
            {bookingErrors.sessionId ? (
              <Alert variant="danger" className="mb-0 mt-3">
                {bookingErrors.sessionId.message}
              </Alert>
            ) : null}
            {bookModalError ? (
              <Alert variant="danger" className="mb-0 mt-3">
                {bookModalError}
              </Alert>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeBookModal}
              disabled={bookingSubmitting}
            >
              Đóng
            </Button>
            <Button type="submit" variant="danger" disabled={bookingSubmitting}>
              {bookingSubmitting ? 'Đang đặt lịch...' : 'Xác nhận đặt lịch'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(cancelTarget)} onHide={closeCancelModal} centered>
        <Modal.Header closeButton={!cancelling}>
          <Modal.Title className="h5">Xác nhận hủy lịch</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Hủy lịch <strong>{cancelTarget?.className || '—'}</strong> của hội viên{' '}
            <strong>{profile.fullName || profile.memberId}</strong>?
          </p>
          <p className="small text-muted mb-0">
            {cancelTarget
              ? dateTimeText(cancelTarget.startTime, cancelTarget.endTime)
              : '—'}
          </p>
          {cancelModalError ? (
            <Alert variant="danger" className="mb-0 mt-3">
              {cancelModalError}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={closeCancelModal}
            disabled={cancelling}
          >
            Giữ lịch
          </Button>
          <Button type="button" variant="danger" onClick={confirmCancel} disabled={cancelling}>
            {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(waitlistTarget)} onHide={closeWaitlistModal} centered size="lg">
        <Modal.Header closeButton={!waitlistSubmitting}>
          <Modal.Title className="h5">Hàng chờ buổi tập</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1 fw-semibold">{waitlistTarget?.className || '—'}</p>
          <p className="small text-muted">
            {waitlistTarget
              ? dateTimeText(waitlistTarget.startTime, waitlistTarget.endTime)
              : '—'}
          </p>
          <ErrorAlert error={waitlistError} title="Không cập nhật được hàng chờ" />
          {waitlistLoading ? (
            <LoadingBlock />
          ) : waitlistRows.length === 0 ? (
            <p className="text-muted mb-0">Chưa có hội viên nào trong hàng chờ.</p>
          ) : (
            <Table responsive size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>Vị trí</th>
                  <th>Hội viên</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {waitlistRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.position ?? '—'}</td>
                    <td>
                      <div className="fw-semibold">{entry.memberFullName || (entry.memberId === accountId ? profile.fullName : 'Hội viên')}</div>
                      <div className="small text-muted">{entry.memberCode || (entry.memberId === accountId ? profile.memberId : 'Chưa có mã hội viên')}</div>
                    </td>
                    <td>{entry.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={closeWaitlistModal}
            disabled={waitlistSubmitting}
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant={
              waitlistRows.some(
                (entry) => entry.memberId === accountId && entry.status === 'WAITING',
              )
                ? 'outline-danger'
                : 'danger'
            }
            onClick={toggleMemberWaitlist}
            disabled={waitlistLoading || waitlistSubmitting}
          >
            {waitlistSubmitting
              ? 'Đang xử lý...'
              : waitlistRows.some(
                    (entry) =>
                      entry.memberId === accountId && entry.status === 'WAITING',
                  )
                ? 'Rời hàng chờ cho hội viên'
                : 'Thêm hội viên vào hàng chờ'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
