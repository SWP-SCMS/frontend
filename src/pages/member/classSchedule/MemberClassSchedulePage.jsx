import { calendarSlotRows, sessionSlotKey } from '../../../utils/sessionSlots';
import Badge from '../../../components/common/SystemBadge';
import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
// Member – Lịch của tôi: lịch tuần các buổi tập MÀ HỘI VIÊN ĐÃ ĐẶT.
//
// Dữ liệu: GET /api/v1/members/me/bookings?status=BOOKED (đủ mọi trang), rồi
// lọc theo tuần đang xem ngay trên trình duyệt. Hủy lịch ở trang "Đăng ký
// lớp" thì buổi đó biến mất khỏi đây (booking chuyển sang CANCELLED).
//
// Xem toàn bộ buổi tập của trung tâm để chọn đặt: trang "Đăng ký lớp"
// (/member/class-booking).
//
// Lưới 7 ngày theo giờ phòng tập, từ Thứ Hai đến Chủ Nhật.
//
// Mỗi phần tử booking đã có sẵn: className, classType, disciplineName,
// coachName, roomName, startTime, endTime nên trang không gọi thêm API nào.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';

import { DateInput } from '../../../components/common/DateInput';
import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import MemberBreadcrumb from '../../../components/layout/MemberBreadcrumb';
import { listMyCourseEnrollments } from '../../../services/courseEnrollmentService';
import { courseScheduleEntries } from '../../../utils/courseWorkflow';
import SessionDetailModal from './SessionDetailModal';
import { getAttendanceDisplay } from './attendance';
import {
  listAllMyBookedBookings,
  toBookingId,
} from '../../../services/memberBookingService';
import {
  GYM_TIME_ZONE,
  ISO_DATE_RE,
  getGymLocalIsoDate,
  getGymZoneTodayIsoDate,
  getWeekRangeDates,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';
import './MemberClassSchedulePage.css';

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
  COURSE: 'Khóa học',
};

const WEEKDAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

// Nhóm các buổi tập theo ngày (YYYY-MM-DD theo giờ phòng tập).
function groupByLocalDay(sessions) {
  const groups = new Map();
  for (const s of sessions || []) {
    const ymd = getGymLocalIsoDate(s?.startTime);
    if (!ymd) continue;
    if (!groups.has(ymd)) groups.set(ymd, []);
    groups.get(ymd).push(s);
  }
  return groups;
}

export default function MemberClassSchedulePage() {
  const [params, setParams] = useSearchParams();

  // Tuần đang xem lấy từ URL (?week=YYYY-MM-DD), mặc định là hôm nay.
  const calYmd = params.get('week') || getGymZoneTodayIsoDate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkedSessionMissing, setLinkedSessionMissing] = useState(false);

  // Buổi tập đang xem chi tiết (null = không mở hộp).
  const [selected, setSelected] = useState(null);
  const handledLinkedSession = useRef(null);
  const linkedSessionId = params.get('sessionId');

  const weekRange = useMemo(() => getWeekRangeDates(calYmd), [calYmd]);
  const weekRangeIso = useMemo(() => {
    if (!weekRange) return null;
    const fromIso = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    const toIso = gymLocalDateToIsoInstant(weekRange.nextMondayYmd, '00:00');
    if (!fromIso || !toIso) return null;
    return { fromIso, toIso };
  }, [weekRange]);

  // Tải toàn bộ lịch đang BOOKED của hội viên (mọi trang).
  const loadBookings = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    commitError(setError, null);
    try {
      const results = await Promise.allSettled([listAllMyBookedBookings(), listMyCourseEnrollments()]);
      if (background && results.some(result => result.status === 'rejected')) throw results.find(result => result.status === 'rejected').reason;
      const gym = results[0].status === 'fulfilled' ? results[0].value : [];
      const courses = results[1].status === 'fulfilled' ? results[1].value : [];
      commitValue(setBookings, [...gym, ...courseScheduleEntries(courses)]);
      if (results.some((result) => result.status === 'rejected')) {
        commitError(setError, new Error('Một phần lịch chưa tải được. Vui lòng tải lại trang.'));
      }
    } catch (err) { failed(err);
      commitError(setError, err);
    } finally {
      if (!background) commitValue(setLoading, false);
    }
  }, []);

  useCachedPollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(loadBookings({ background, commitValue, commitError, failed }));
  }, [loadBookings], { key: ['member-schedule'], setters: [setBookings], setLoading });

  // Các buổi đã đặt nằm trong tuần đang xem.
  const weekSessions = useMemo(() => {
    if (!weekRangeIso) return [];
    const from = new Date(weekRangeIso.fromIso).getTime();
    const to = new Date(weekRangeIso.toIso).getTime();
    return bookings
      .filter((b) => {
        const t = new Date(b.startTime).getTime();
        return t >= from && t < to;
      })
      .map((b) => ({ ...b, id: toBookingId(b) ?? b.sessionId }))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [bookings, weekRangeIso]);

  const setWeek = useCallback(
    (ymd) => {
      if (!ymd || !ISO_DATE_RE.test(ymd)) return;
      const next = new URLSearchParams(params);
      next.set('week', ymd);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    if (loading || error || !linkedSessionId || handledLinkedSession.current === linkedSessionId) return;

    handledLinkedSession.current = linkedSessionId;
    const booking = bookings.find((item) => String(item.sessionId) === linkedSessionId);
    if (!booking) {
      setLinkedSessionMissing(true);
      return;
    }

    const sessionDate = getGymLocalIsoDate(booking.startTime);
    if (sessionDate) setWeek(sessionDate);
    setLinkedSessionMissing(false);
    setSelected({ ...booking, id: toBookingId(booking) ?? booking.sessionId });
  }, [bookings, error, linkedSessionId, loading, setWeek]);

  const closeSelected = useCallback(() => {
    setSelected(null);
    if (!params.has('sessionId')) return;
    const next = new URLSearchParams(params);
    next.delete('sessionId');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const shiftCalendarWeek = useCallback(
    (delta) => {
      const ref = new Date(`${calYmd}T12:00:00+07:00`);
      if (Number.isNaN(ref.getTime())) return;
      ref.setUTCDate(ref.getUTCDate() + delta * 7);
      setWeek(getGymLocalIsoDate(ref.toISOString()));
    },
    [calYmd, setWeek],
  );

  return (
    <div className="mcs-page">
      <header className="mcs-top">
        <div>
          <MemberBreadcrumb current="Lịch của tôi" />
          <h1 className="mcs-title">Lịch của tôi</h1>
          <p className="mcs-sub">
            Lịch khóa học, lớp gym và PT đã đăng ký theo từng tuần. Quản lý khóa học trong mục Khóa học của tôi.
          </p>
        </div>
      </header>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => shiftCalendarWeek(-1)}
              aria-label="Tuần trước"
            >
              ‹ Tuần trước
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setWeek(getGymZoneTodayIsoDate())}
            >
              Hôm nay
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => shiftCalendarWeek(1)}
              aria-label="Tuần sau"
            >
              Tuần sau ›
            </Button>
            <div className="d-flex align-items-center gap-1">
              <Form.Label htmlFor="mcs-cal-pick" className="small text-muted mb-0">
                Chọn ngày
              </Form.Label>
              <DateInput
                id="mcs-cal-pick"
                size="sm"
                value={calYmd}
                onChange={setWeek}
                aria-label="Chọn ngày để chuyển tuần"
              />
            </div>
          </div>
          <CalendarHeaderLabel weekRange={weekRange} />
        </Card.Body>
      </Card>

      <ErrorAlert
        error={error}
        title="Không tải được lịch của bạn"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      {linkedSessionMissing ? (
        <Alert variant="warning">
          Không tìm thấy buổi tập này trong lịch đang đặt của bạn. Buổi tập có thể đã bị hủy hoặc không còn hiệu lực.
        </Alert>
      ) : null}

      <CalendarView
        loading={loading}
        sessions={weekSessions}
        weekRange={weekRange}
        onSelect={setSelected}
      />

      <SessionDetailModal
        session={selected}
        onClose={closeSelected}
      />
    </div>
  );
}

// ----- Nhãn tuần (Thứ Hai → Chủ Nhật) -----
function CalendarHeaderLabel({ weekRange }) {
  const label = useMemo(() => {
    if (!weekRange) return '';
    const mondayIso = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    if (!mondayIso) return '';
    const mondayDate = new Date(mondayIso);
    if (Number.isNaN(mondayDate.getTime())) return '';
    const sunday = new Date(mondayDate.getTime());
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const startStr = mondayDate.toLocaleDateString('vi-VN', {
      timeZone: GYM_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
    });
    const endStr = sunday.toLocaleDateString('vi-VN', {
      timeZone: GYM_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Tuần ${startStr} – ${endStr}`;
  }, [weekRange]);
  return <div className="text-muted small">{label}</div>;
}

// ----- Lưới lịch tuần -----
function CalendarView({ loading, sessions, weekRange, onSelect }) {
  const days = useMemo(() => {
    if (!weekRange) return [];
    const monday = new Date(`${weekRange.mondayYmd}T12:00:00+07:00`);
    if (Number.isNaN(monday.getTime())) return [];
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      out.push({
        ymd: getGymLocalIsoDate(d.toISOString()),
        dayMonth: d.toLocaleDateString('vi-VN', {
          timeZone: GYM_TIME_ZONE,
          day: '2-digit',
          month: '2-digit',
        }),
        weekday: WEEKDAY_LABELS[i],
      });
    }
    return out;
  }, [weekRange]);

  const [expandedCells, setExpandedCells] = useState(new Set());
  const rows = calendarSlotRows((sessions || []).filter(s => days.some(day => day.ymd === getGymLocalIsoDate(s.startTime))));
  const grouped = useMemo(() => groupByLocalDay(sessions || []), [sessions]);

  // "Hôm nay" theo giờ phòng tập, không theo giờ của trình duyệt.
  const todayYmd = useMemo(() => getGymZoneTodayIsoDate(), []);

  return (
    <div className="mcs-cal">
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <div className="mcs-cal-scroll" role="grid" aria-label="Lịch của tôi">
          <div className="mcs-cal-table">
            <div className="mcs-cal-head" role="row">
              <div className="mcs-cal-head-cell" role="columnheader">Khung giờ</div>
              {days.map((day) => (
                <div
                  key={`h-${day.ymd}`}
                  className={`mcs-cal-head-cell${day.ymd === todayYmd ? ' mcs-cal-today' : ''}`}
                  role="columnheader"
                >
                  <div className="mcs-cal-weekday">{day.weekday}</div>
                  <div className="mcs-cal-daymonth">{day.dayMonth}</div>
                  {day.ymd === todayYmd ? (
                    <div className="mcs-cal-today-tag">Hôm nay</div>
                  ) : null}
                </div>
              ))}
            </div>
            {rows.map(slot => <div className="mcs-cal-body" role="row" key={slot.key}>
              <div className="mcs-cal-slot" role="rowheader"><strong>{slot.label}</strong><small>{slot.start}–{slot.end}</small></div>
              {days.map((day) => {
                const daySessions = (grouped.get(day.ymd) || []).filter(s => sessionSlotKey(s) === slot.key);
                const cellKey = `${day.ymd}-${slot.key}`;
                const expanded = expandedCells.has(cellKey);
                return (
                  <div
                    key={`c-${day.ymd}`}
                    className={`mcs-cal-cell${day.ymd === todayYmd ? ' mcs-cal-today' : ''}`}
                    role="gridcell"
                  >
                    {daySessions.length === 0 ? (
                      <div className="mcs-cal-empty" aria-label="Không có buổi tập">—</div>
                    ) : (
                      daySessions.slice(0, expanded ? undefined : 1).map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          onClick={() => onSelect(s)}
                        />
                      ))
                    )}
                    {daySessions.length > 1 && <Button size="sm" variant="outline-secondary" className="w-100 mt-2" aria-expanded={expanded} onClick={() => setExpandedCells(current => {
                      const next = new Set(current); if (expanded) next.delete(cellKey); else next.add(cellKey); return next;
                    })}>{expanded ? 'Thu gọn ▴' : `Xem tất cả ${daySessions.length} lớp ▾`}</Button>}
                  </div>
                );
              })}
            </div>)}
          </div>
        </div>
      )}
      {!loading && (sessions || []).length === 0 ? (
        <EmptyState
          title="Tuần này bạn chưa đăng ký buổi tập nào"
          message="Hãy thử tuần khác, hoặc đăng ký lớp mới."
          action={
            <Link to="/member/class-booking" className="btn btn-outline-danger btn-sm">
              Đăng ký lớp
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

// ----- Một buổi tập trong lưới (bấm để xem chi tiết) -----
function SessionCard({ session, onClick }) {
  const s = session || {};
  const att = getAttendanceDisplay(s);
  return (
    <button
      type="button"
      className="mcs-cal-session mcs-cal-session-btn text-reset"
      onClick={onClick}
      aria-label={`Xem chi tiết ${s.className || 'buổi tập'}`}
    >
      <div className="mcs-cal-session-class">{s.courseName || s.className || '—'}</div>
      {s.classType === 'COURSE' && <div className="mcs-cal-session-course">
        <span>{s.runCode}</span><span>Buổi {s.unitNumber}</span>
      </div>}
      <div className="mcs-cal-session-meta">
        <span>HLV: {s.coachName || 'Chưa có HLV'}</span>
        <span>Phòng: {s.roomName || 'Chưa có phòng'}</span>
      </div>
      <div className="mcs-cal-session-foot">
        <ClassTypePill classType={s.classType} small />
        {/* Xám: chưa điểm danh. Xanh: đã điểm danh. Đỏ: vắng (quá hạn mà chưa PRESENT). */}
        <Badge
          className={`badge mcs-pill-sm ${
            att.key === 'present'
              ? 'bg-success-subtle text-success-emphasis'
              : att.key === 'absent'
                ? 'bg-danger-subtle text-danger-emphasis'
                : 'bg-secondary-subtle text-secondary-emphasis'
          }`}
        >
          {att.text}
        </Badge>
      </div>
    </button>
  );
}

function ClassTypePill({ classType, small }) {
  const label = CLASS_TYPE_LABEL[classType] || '—';
  const cls = [
    'badge',
    'bg-danger-subtle',
    'text-danger-emphasis',
    small ? 'mcs-pill-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{label}</span>;
}
