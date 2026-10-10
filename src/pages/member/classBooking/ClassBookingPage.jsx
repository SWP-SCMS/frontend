// Member – Đăng ký lớp (đặt / hủy lịch các buổi tập).
//
// API:
//   GET   /api/v1/members/class-sessions                      các buổi tập sắp tới
//   POST  /api/v1/members/class-sessions/{id}/bookings        đặt lịch
//   GET   /api/v1/members/me/bookings?status=BOOKED           lịch đã đặt
//   PATCH /api/v1/members/me/bookings/{id}/cancel             hủy lịch
//
// BE chỉ lọc buổi tập theo ngày (from/to), KHÔNG lọc theo bộ môn, huấn luyện
// viên hay trạng thái. Vì vậy trang tải TẤT CẢ các trang của khoảng ngày đã
// chọn rồi lọc trên trình duyệt, nhờ đó số đếm ở các nút bộ môn là đúng.
//
// Quy tắc nghiệp vụ (BE kiểm tra lại, FE chỉ gợi ý giao diện):
//   BR-BKG-03/05: chỉ gói PLUS còn hiệu lực mới đặt được lịch.
//   BR-BKG-04   : buổi tập còn chỗ, không trùng giờ, chưa đặt trước đó.
//   BR-BKG-06   : chỉ hủy được khi còn ít nhất 2 giờ trước giờ bắt đầu.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Modal, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { useAuth } from '../../../context/useAuth';
import MemberBreadcrumb from '../../../components/layout/MemberBreadcrumb';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { listMemberClassSessions } from '../../../services/memberClassSessionService';
import {
  bookClassSession,
  cancelMyBooking,
  listAllMyBookedBookings,
  toBookingId,
} from '../../../services/memberBookingService';
import {
  formatGymDayHeading,
  formatGymTime,
  getGymLocalIsoDate,
  gymEndOfDayIsoInstant,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';
import './ClassBookingPage.css';

const SESSIONS_PAGE_SIZE = 100; // BE cho phép tối đa 100 / trang
const SHOW_STEP = 20; // mỗi lần hiển thị thêm 20 buổi
const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // BR-BKG-06: 2 giờ

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'booked', label: 'Đã đặt' },
  { value: 'unbooked', label: 'Chưa đặt' },
  { value: 'open', label: 'Còn chỗ' },
];

// Thông báo theo mã lỗi của BE (xử lý theo status / code, không đọc `detail`).
const BOOKING_ERROR_MESSAGES = {
  BOOKING_PLUS_MEMBERSHIP_REQUIRED:
    'Bạn cần có gói PLUS còn hiệu lực vào thời điểm buổi tập để đặt lịch.',
  BOOKING_DUPLICATE: 'Bạn đã đặt buổi tập này rồi.',
  BOOKING_TIME_CONFLICT: 'Buổi tập này trùng giờ với một buổi bạn đã đặt.',
  SESSION_FULL: 'Buổi tập đã hết chỗ.',
  SESSION_NOT_BOOKABLE:
    'Buổi tập này không còn nhận đặt lịch (đã bắt đầu hoặc đã bị hủy).',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi tập.',
  BOOKING_CONFLICT:
    'Số chỗ vừa thay đổi nên chưa xác nhận được. Vui lòng thử lại.',
  MEMBER_NOT_ACTIVE:
    'Tài khoản của bạn không ở trạng thái cho phép đặt lịch.',
  BOOKING_CANCELLATION_WINDOW_CLOSED:
    'Chỉ được hủy lịch trước giờ bắt đầu ít nhất 2 giờ.',
  BOOKING_NOT_BOOKED: 'Lịch này không còn ở trạng thái đã đặt.',
  BOOKING_NOT_FOUND: 'Không tìm thấy lịch đã đặt.',
};

function bookingErrorMessage(err, fallback) {
  const code = err?.response?.data?.code;
  if (code && BOOKING_ERROR_MESSAGES[code]) return BOOKING_ERROR_MESSAGES[code];
  if (!err?.response) return 'Không kết nối được máy chủ. Vui lòng thử lại.';
  if (err.response.status === 403) {
    return 'Tài khoản của bạn không có quyền thực hiện thao tác này.';
  }
  return fallback;
}

// Tải mọi trang của khoảng ngày (BE giới hạn 100 buổi / trang).
async function fetchAllSessions({ fromIso, toIso }) {
  const all = [];
  let page = 0;
  for (;;) {
    const data = await listMemberClassSessions({
      from: fromIso,
      to: toIso,
      page,
      size: SESSIONS_PAGE_SIZE,
    });
    const content = Array.isArray(data?.content) ? data.content : [];
    all.push(...content);
    const totalPages = typeof data?.totalPages === 'number' ? data.totalPages : 0;
    if (content.length === 0 || page + 1 >= totalPages) break;
    page += 1;
  }
  return all;
}

// Khóa dùng để lọc: ưu tiên id, không có thì dùng tên.
const disciplineKey = (s) => s.disciplineId ?? s.disciplineName ?? '';
const coachKey = (s) => s.coachId ?? s.coachName ?? '';

// Đếm theo khóa -> [{ key, label, count }] sắp theo tên.
function countBy(sessions, keyOf, labelOf) {
  const map = new Map();
  for (const s of sessions) {
    const key = keyOf(s);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { key, label: labelOf(s) || '—', count: 1 });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

// ----- Icon SVG nhỏ (không cài thư viện icon) -----
const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function CoachIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <circle cx="18" cy="16" r="3" />
      <path d="m20.2 18.2 2 2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 3H2l8 9.5V19l4 2v-8.5z" />
    </svg>
  );
}

export default function ClassBookingPage() {
  const { user } = useAuth();
  const {
    activeMembership,
    hasActiveMembership,
    loading: membershipLoading,
  } = useMemberArea();

  // BR-BKG-03/05: chỉ PLUS mới đặt được lịch.
  const planCode = activeMembership?.planCode ?? activeMembership?.plan_code_snapshot ?? '';
  const isPlus = hasActiveMembership && planCode === 'PLUS';

  // Khoảng ngày (để trống = mọi buổi tập sắp tới).
  const [fromYmd, setFromYmd] = useState('');
  const [toYmd, setToYmd] = useState('');

  // Bộ lọc.
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [coachFilter, setCoachFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(SHOW_STEP);

  // Dữ liệu.
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookedMap, setBookedMap] = useState({}); // sessionId -> bookingId
  const [bookingsError, setBookingsError] = useState(null);

  // Hành động.
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Hộp xác nhận đặt chỗ: buổi tập đang xem + lỗi BE trả về (nếu có).
  const [bookTarget, setBookTarget] = useState(null);
  const [bookError, setBookError] = useState(null);

  // "Bây giờ" cập nhật mỗi phút, dùng để biết buổi nào còn hủy được (BR-BKG-06).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const rangeInvalid = Boolean(fromYmd && toYmd && fromYmd > toYmd);
  const rangeIso = useMemo(() => {
    const out = {};
    if (fromYmd) out.fromIso = gymLocalDateToIsoInstant(fromYmd, '00:00');
    // "Đến ngày X" tính hết ngày X.
    if (toYmd) out.toIso = gymEndOfDayIsoInstant(toYmd);
    return out;
  }, [fromYmd, toYmd]);

  // Bỏ qua kết quả của các lần tải cũ (đổi bộ lọc nhanh).
  const requestRef = useRef(0);

  const loadSessions = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestRef.current;
      if (rangeInvalid) {
        setSessions([]);
        setError(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const rows = await fetchAllSessions(rangeIso);
        if (requestId === requestRef.current) setSessions(rows);
      } catch (err) {
        if (requestId === requestRef.current) setError(err);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [rangeInvalid, rangeIso],
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadBookings = useCallback(async () => {
    try {
      const rows = await listAllMyBookedBookings();
      const map = {};
      for (const b of rows) {
        if (b?.sessionId) map[b.sessionId] = toBookingId(b);
      }
      setBookedMap(map);
      setBookingsError(null);
    } catch (err) {
      setBookingsError(err);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // ----- Dữ liệu cho bộ lọc -----
  const disciplines = useMemo(
    () => countBy(sessions, disciplineKey, (s) => s.disciplineName),
    [sessions],
  );
  const coaches = useMemo(
    () => countBy(sessions, coachKey, (s) => s.coachName),
    [sessions],
  );

  const filtered = useMemo(() => {
    const list = sessions.filter((s) => {
      if (disciplineFilter && disciplineKey(s) !== disciplineFilter) return false;
      if (coachFilter && coachKey(s) !== coachFilter) return false;
      const booked = Boolean(bookedMap[s.id]);
      const avail =
        typeof s.availableCapacity === 'number' ? s.availableCapacity : null;
      if (statusFilter === 'booked') return booked;
      if (statusFilter === 'unbooked') return !booked;
      if (statusFilter === 'open') return avail != null && avail > 0;
      return true;
    });
    return list.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [sessions, disciplineFilter, coachFilter, statusFilter, bookedMap]);

  // Nhóm theo ngày, chỉ lấy `visibleCount` buổi đầu.
  const groups = useMemo(() => {
    const out = [];
    for (const s of filtered.slice(0, visibleCount)) {
      const ymd = getGymLocalIsoDate(s.startTime);
      const last = out[out.length - 1];
      if (last && last.ymd === ymd) last.items.push(s);
      else out.push({ ymd, label: formatGymDayHeading(s.startTime), items: [s] });
    }
    return out;
  }, [filtered, visibleCount]);

  const filtersActive =
    Boolean(disciplineFilter) || Boolean(coachFilter) || statusFilter !== 'all';
  const anyFilterOrRange = filtersActive || Boolean(fromYmd) || Boolean(toYmd);

  function changeFilter(setter, value) {
    setter(value);
    setVisibleCount(SHOW_STEP);
  }

  function clearAll() {
    setDisciplineFilter('');
    setCoachFilter('');
    setStatusFilter('all');
    setFromYmd('');
    setToYmd('');
    setVisibleCount(SHOW_STEP);
  }

  // ----- Đặt lịch -----
  // Bấm "Đặt lịch" chỉ mở hộp xác nhận; hội viên bấm "Xác nhận" mới gọi API.
  function openBookConfirm(session) {
    setActionError(null);
    setNotice(null);
    setBookError(null);
    setBookTarget(session);
  }

  function closeBookConfirm() {
    if (busyId) return; // đang gọi API thì chưa cho đóng
    setBookTarget(null);
    setBookError(null);
  }

  async function handleConfirmBook() {
    const session = bookTarget;
    if (!session) return;
    setBookError(null);
    setBusyId(session.id);
    try {
      const booking = await bookClassSession(session.id);
      setBookedMap((m) => ({ ...m, [session.id]: toBookingId(booking) }));
      setNotice(
        `Đã đặt lịch "${session.className}" lúc ${formatGymTime(session.startTime)} ${formatGymDayHeading(session.startTime)}.`,
      );
      setBookTarget(null);
      // Lấy lại số chỗ chính xác từ BE (không tự trừ ở FE).
      loadSessions({ silent: true });
    } catch (err) {
      // Giữ hộp xác nhận mở và hiện lỗi BE trả về ngay trong hộp.
      setBookError(bookingErrorMessage(err, 'Không đặt được lịch.'));
      if (err?.response?.status === 409) {
        // Dữ liệu trên màn hình đã cũ -> đồng bộ lại.
        loadSessions({ silent: true });
        loadBookings();
      }
    } finally {
      setBusyId(null);
    }
  }

  // ----- Hủy lịch -----
  async function handleConfirmCancel() {
    const session = cancelTarget;
    const bookingId = session ? bookedMap[session.id] : null;
    if (!session || !bookingId) {
      setCancelTarget(null);
      return;
    }
    setActionError(null);
    setNotice(null);
    setBusyId(session.id);
    try {
      await cancelMyBooking(bookingId);
      setBookedMap((m) => {
        const next = { ...m };
        delete next[session.id];
        return next;
      });
      setNotice(`Đã hủy lịch "${session.className}".`);
      loadSessions({ silent: true });
    } catch (err) {
      setActionError({ message: bookingErrorMessage(err, 'Không hủy được lịch.') });
      if (err?.response?.status === 409) {
        loadSessions({ silent: true });
        loadBookings();
      }
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  // ----- Hiển thị -----
  let body;
  if (loading) {
    body = (
      <div className="cbs-center">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  } else if (rangeInvalid) {
    body = (
      <div className="cbs-empty">
        <strong>Khoảng ngày không hợp lệ</strong>
        Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
      </div>
    );
  } else if (sessions.length === 0) {
    body = (
      <div className="cbs-empty">
        <strong>Chưa có buổi tập nào sắp tới</strong>
        {fromYmd || toYmd
          ? 'Thử đổi hoặc bỏ khoảng ngày.'
          : 'Hệ thống chưa có buổi tập nào để đặt. Vui lòng quay lại sau.'}
      </div>
    );
  } else if (filtered.length === 0) {
    body = (
      <div className="cbs-empty">
        <strong>Không có buổi tập phù hợp bộ lọc</strong>
        Thử đổi hoặc bỏ bộ lọc.
      </div>
    );
  } else {
    body = (
      <>
        {groups.map((group) => (
          <div className="cbs-day" key={group.ymd}>
            <h3 className="cbs-day-title">{group.label}</h3>
            <div className="cbs-list">
              {group.items.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  booked={Boolean(bookedMap[s.id])}
                  busy={busyId === s.id}
                  isPlus={isPlus}
                  membershipLoading={membershipLoading}
                  nowMs={nowMs}
                  onBook={() => openBookConfirm(s)}
                  onCancel={() => setCancelTarget(s)}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="cbs-footer">
          <span>
            Hiển thị {Math.min(visibleCount, filtered.length)} / {filtered.length}{' '}
            buổi tập
          </span>
          {visibleCount < filtered.length ? (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setVisibleCount((n) => n + SHOW_STEP)}
            >
              Xem thêm
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="cbs">
      <header className="cbs-top">
        <MemberBreadcrumb current="Đăng ký lớp" />
        <h1 className="cbs-title">Đăng ký lớp</h1>
        <p className="cbs-sub">
          Chọn buổi tập sắp tới và đặt lịch. Chỉ hội viên gói PLUS mới đặt được
          lịch.
        </p>
      </header>

      <h2 className="cbs-heading">Đặt lịch tập</h2>

      {/* ----- Bảng lọc / sắp xếp ----- */}
      <div className="cbs-filter">
        <div className="cbs-chips">
          <span className="cbs-chips-label">Bộ môn:</span>
          <button
            type="button"
            className={`cbs-chip${disciplineFilter === '' ? ' active' : ''}`}
            onClick={() => changeFilter(setDisciplineFilter, '')}
          >
            Tất cả ({sessions.length})
          </button>
          {disciplines.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`cbs-chip${disciplineFilter === d.key ? ' active' : ''}`}
              onClick={() => changeFilter(setDisciplineFilter, d.key)}
            >
              {d.label} ({d.count})
            </button>
          ))}
        </div>

        <div className="cbs-selects">
          <div className="cbs-select">
            <span className="cbs-select-icon">
              <CoachIcon />
            </span>
            <select
              aria-label="Lọc theo huấn luyện viên"
              value={coachFilter}
              onChange={(e) => changeFilter(setCoachFilter, e.target.value)}
            >
              <option value="">Tất cả huấn luyện viên</option>
              {coaches.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
          </div>

          <div className="cbs-select">
            <span className="cbs-select-icon">
              <FilterIcon />
            </span>
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(e) => changeFilter(setStatusFilter, e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cbs-dates">
            <label htmlFor="cbs-from">Từ ngày</label>
            <input
              id="cbs-from"
              type="date"
              className="cbs-date"
              value={fromYmd}
              onChange={(e) => changeFilter(setFromYmd, e.target.value)}
            />
            <label htmlFor="cbs-to">Đến ngày</label>
            <input
              id="cbs-to"
              type="date"
              className="cbs-date"
              value={toYmd}
              onChange={(e) => changeFilter(setToYmd, e.target.value)}
            />
            <button
              type="button"
              className="cbs-clear"
              onClick={clearAll}
              disabled={!anyFilterOrRange}
            >
              Bỏ bộ lọc
            </button>
          </div>
        </div>
        {rangeInvalid ? (
          <div className="cbs-range-error">
            Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
          </div>
        ) : null}
      </div>

      {/* ----- Thông báo ----- */}
      {notice ? (
        <Alert
          variant="success"
          dismissible
          onClose={() => setNotice(null)}
          className="mb-3"
        >
          {notice}
        </Alert>
      ) : null}
      <ErrorAlert
        error={actionError}
        title="Không thực hiện được"
        onClose={() => setActionError(null)}
      />
      <ErrorAlert error={error} title="Không tải được danh sách buổi tập" />
      <ErrorAlert
        error={bookingsError}
        title="Không tải được các lịch bạn đã đặt"
      />

      {body}

      {/* ----- Xác nhận đặt chỗ ----- */}
      <BookingConfirmModal
        session={bookTarget}
        memberName={user?.fullName}
        memberCode={user?.memberId}
        planCode={planCode}
        busy={Boolean(busyId)}
        error={bookError}
        onClose={closeBookConfirm}
        onConfirm={handleConfirmBook}
      />

      {/* ----- Xác nhận hủy lịch ----- */}
      <Modal
        show={Boolean(cancelTarget)}
        onHide={() => (busyId ? null : setCancelTarget(null))}
        centered
      >
        <Modal.Header closeButton={!busyId}>
          <Modal.Title className="h5">Hủy lịch tập</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Bạn có chắc muốn hủy lịch &quot;{cancelTarget?.className}&quot; lúc{' '}
          {formatGymTime(cancelTarget?.startTime)}{' '}
          {cancelTarget ? formatGymDayHeading(cancelTarget.startTime) : ''}?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setCancelTarget(null)}
            disabled={Boolean(busyId)}
          >
            Giữ lịch
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmCancel}
            disabled={Boolean(busyId)}
          >
            {busyId ? 'Đang hủy...' : 'Hủy lịch'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ----- Icon cho các dòng thông tin trong hộp xác nhận -----
const ROW_ICONS = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  room: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  coach: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2M12 12v3M10.5 13.5h3" />
    </>
  ),
  member: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.5a7 7 0 0 1 11.6 0" />
    </>
  ),
  plan: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M17 11a3 3 0 1 0-1-5.8M22 21a6 6 0 0 0-4-5.6" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

function RowIcon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ROW_ICONS[name]}
    </svg>
  );
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="cbs-mrow">
      <span className="cbs-mrow-label">
        <RowIcon name={icon} />
        {label}
      </span>
      <span className="cbs-mrow-value">{children}</span>
    </div>
  );
}

// ----- Hộp xác nhận đặt chỗ -----
// Mọi thông tin lấy từ chính buổi tập hội viên vừa chọn (không gõ cứng).
function BookingConfirmModal({
  session,
  memberName,
  memberCode,
  planCode,
  busy,
  error,
  onClose,
  onConfirm,
}) {
  const s = session;
  const avail = typeof s?.availableCapacity === 'number' ? s.availableCapacity : null;
  const subtitle = [s?.disciplineName, CLASS_TYPE_LABEL[s?.classType]]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal
      show={Boolean(s)}
      onHide={onClose}
      centered
      dialogClassName="cbs-dialog"
      aria-labelledby="cbs-confirm-title"
    >
      <Modal.Body className="cbs-modal">
        <div className="cbs-mhead">
          <div>
            <h2 className="cbs-mtitle" id="cbs-confirm-title">
              {s?.className || '—'}
            </h2>
            {subtitle ? <p className="cbs-msub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="cbs-mclose"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
          >
            <RowIcon name="close" size={18} />
          </button>
        </div>

        <div className="cbs-mcard">
          <InfoRow icon="calendar" label="Thời gian:">
            {s ? formatGymDayHeading(s.startTime) : '—'} •{' '}
            {formatGymTime(s?.startTime)} - {formatGymTime(s?.endTime)}
          </InfoRow>
          <InfoRow icon="room" label="Phòng tập:">
            {s?.roomName || '—'}
          </InfoRow>
          <InfoRow icon="coach" label="HLV phụ trách:">
            {s?.coachName || '—'}
          </InfoRow>
          <InfoRow icon="member" label="Hội viên đăng ký:">
            {memberName || '—'}
            {memberCode ? ` (${memberCode})` : ''}
          </InfoRow>
          <InfoRow icon="plan" label="Gói áp dụng:">
            <span className="cbs-plan-pill">
              GÓI {planCode || 'PLUS'} • Hợp lệ
            </span>
          </InfoRow>
          <InfoRow icon="users" label="Số lượng:">
            <span className={avail != null && avail <= 0 ? 'cbs-qty full' : 'cbs-qty'}>
              {s?.bookedCount ?? '—'} / {s?.capacity ?? '—'} -{' '}
              {avail != null && avail <= 0 ? 'Hết chỗ' : 'Còn chỗ'}
            </span>
          </InfoRow>
        </div>

        <div className="cbs-mnote">
          <RowIcon name="info" />
          <span>
            <strong>Lưu ý:</strong> Nếu không thể tham gia, vui lòng bấm
            &quot;Hủy lịch&quot; tối thiểu 2 giờ trước giờ bắt đầu để nhường chỗ
            cho hội viên khác.
          </span>
        </div>

        {error ? (
          <div className="cbs-merror" role="alert">
            {error}
          </div>
        ) : null}

        <div className="cbs-mactions">
          <button
            type="button"
            className="cbs-mbtn ghost"
            onClick={onClose}
            disabled={busy}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="cbs-mbtn primary"
            onClick={onConfirm}
            disabled={busy}
          >
            <RowIcon name="check" size={16} />
            {busy ? 'Đang đặt chỗ...' : 'Xác nhận đặt chỗ (Miễn phí theo gói PLUS)'}
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

// ----- Một buổi tập trong danh sách -----
function SessionItem({
  session,
  booked,
  busy,
  isPlus,
  membershipLoading,
  nowMs,
  onBook,
  onCancel,
}) {
  const s = session;
  const avail = typeof s.availableCapacity === 'number' ? s.availableCapacity : null;
  const full = avail != null && avail <= 0;
  // BR-BKG-06: chỉ hủy được khi còn ít nhất 2 giờ trước giờ bắt đầu.
  const canCancel = new Date(s.startTime).getTime() - nowMs >= CANCEL_WINDOW_MS;

  return (
    <div className={`cbs-item${booked ? ' booked' : ''}`}>
      <div className="cbs-time">
        {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
      </div>

      <div className="cbs-info">
        <div className="cbs-class">{s.className || '—'}</div>
        <div className="cbs-meta">
          {s.coachName || '—'} · {s.roomName || '—'}
        </div>
        <div className="cbs-tags">
          <span className="cbs-tag">{CLASS_TYPE_LABEL[s.classType] || '—'}</span>
          {s.disciplineName ? (
            <span className="cbs-tag gray">{s.disciplineName}</span>
          ) : null}
          {avail == null ? null : full ? (
            <span className="cbs-tag gray">Hết chỗ</span>
          ) : (
            <span className="cbs-tag green">Còn {avail} chỗ</span>
          )}
        </div>
      </div>

      <div className="cbs-action">
        {booked ? (
          <>
            <span className="cbs-tag green">Đã đặt</span>
            <button
              type="button"
              className="cbs-btn cancel"
              disabled={busy || !canCancel}
              onClick={onCancel}
            >
              Hủy lịch
            </button>
            {!canCancel ? (
              <span className="cbs-note">Chỉ hủy được trước giờ tập 2 giờ</span>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="cbs-btn"
              disabled={busy || full || !isPlus}
              onClick={onBook}
            >
              {busy ? 'Đang đặt...' : full ? 'Hết chỗ' : 'Đặt lịch'}
            </button>
            {!isPlus && !full ? (
              <span className="cbs-note">
                {membershipLoading
                  ? 'Đang kiểm tra gói tập...'
                  : 'Cần gói PLUS để đặt lịch'}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
