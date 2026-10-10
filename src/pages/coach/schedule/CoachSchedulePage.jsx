// Lịch phụ trách của Huấn luyện viên: lịch tuần (Thứ Hai → Chủ Nhật) các buổi
// MÌNH đứng lớp. Giao diện dùng lại CSS của "Lịch của tôi" bên Hội viên (mcs-*).
//
// Dữ liệu:
//   - GET /coach/class-sessions?from&to : các buổi trong tuần (BE lọc theo Coach)
//   - GET /coach/class-sessions/{id}    : lấy tên lớp, phòng, loại lớp, cho
//     từng thẻ (danh sách chưa có các trường này). Mỗi tuần chỉ vài
//     buổi nên gọi song song.
// Bấm một thẻ để xem chi tiết + điểm danh (CoachSessionModal).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Form, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import {
  getCoachSession,
  listCoachSessions,
} from '../../../services/coachScheduleService';
import {
  GYM_TIME_ZONE,
  ISO_DATE_RE,
  formatGymTime,
  getGymLocalIsoDate,
  getGymZoneTodayIsoDate,
  getWeekRangeDates,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';
import CoachSessionModal from './CoachSessionModal';
import { SESSION_STATUS_LABELS } from './sessionStatus';
import '../../member/classSchedule/MemberClassSchedulePage.css';

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
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
  for (const s of sessions) {
    const ymd = getGymLocalIsoDate(s.startTime);
    if (!ymd) continue;
    if (!groups.has(ymd)) groups.set(ymd, []);
    groups.get(ymd).push(s);
  }
  return groups;
}

export default function CoachSchedulePage() {
  const [params, setParams] = useSearchParams();

  // Tuần đang xem lấy từ URL (?week=YYYY-MM-DD), mặc định là hôm nay.
  const calYmd = params.get('week') || getGymZoneTodayIsoDate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const weekRange = useMemo(() => getWeekRangeDates(calYmd), [calYmd]);

  // `isStale()` cho biết tuần đã đổi trong lúc đang tải: bỏ kết quả cũ để
  // không ghi đè dữ liệu của tuần mới.
  const load = useCallback(async (isStale = () => false) => {
    if (!weekRange) return;
    const from = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    const to = gymLocalDateToIsoInstant(weekRange.nextMondayYmd, '00:00');
    setLoading(true);
    setError(null);
    try {
      const res = await listCoachSessions({ from, to, size: 100 });
      const list = res.content ?? [];
      // Bổ sung tên lớp / phòng từ API chi tiết; lỗi một buổi thì giữ dữ liệu cơ bản.
      const details = await Promise.all(
        list.map((s) => getCoachSession(s.id).catch(() => null)),
      );
      if (isStale()) return;
      setSessions(
        list.map((s, i) => ({
          ...s,
          className: details[i]?.className,
          classType: details[i]?.classType,
          roomName: details[i]?.roomName,
        })),
      );
    } catch (err) {
      if (!isStale()) setError(err);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [weekRange]);

  useEffect(() => {
    let stale = false;
    load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const setWeek = useCallback(
    (ymd) => {
      if (!ymd || !ISO_DATE_RE.test(ymd)) return;
      const next = new URLSearchParams(params);
      next.set('week', ymd);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const shiftWeek = useCallback(
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
          <h1 className="mcs-title">Lịch phụ trách</h1>
          <p className="mcs-sub">
            Các buổi tập bạn đứng lớp, theo từng tuần. Bấm vào một buổi để xem
            học viên và điểm danh.
          </p>
        </div>
      </header>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => shiftWeek(-1)}
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
              onClick={() => shiftWeek(1)}
            >
              Tuần sau ›
            </Button>
            <div className="d-flex align-items-center gap-1">
              <Form.Label htmlFor="coach-cal-pick" className="small text-muted mb-0">
                Chọn ngày
              </Form.Label>
              <Form.Control
                id="coach-cal-pick"
                type="date"
                size="sm"
                value={calYmd}
                onChange={(e) => setWeek(e.target.value)}
                aria-label="Chọn ngày để chuyển tuần"
              />
            </div>
          </div>
          <WeekLabel weekRange={weekRange} />
        </Card.Body>
      </Card>

      <ErrorAlert
        error={error}
        title="Không tải được lịch phụ trách"
        onClose={() => setError(null)}
      />

      <CalendarView
        loading={loading}
        sessions={sessions}
        weekRange={weekRange}
        onSelect={(s) => setSelectedId(s.id)}
      />

      {selectedId ? (
        <CoachSessionModal
          sessionId={selectedId}
          onHide={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

// ----- Nhãn tuần -----
function WeekLabel({ weekRange }) {
  const label = useMemo(() => {
    if (!weekRange) return '';
    const mondayIso = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    if (!mondayIso) return '';
    const monday = new Date(mondayIso);
    const sunday = new Date(monday.getTime());
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const startStr = monday.toLocaleDateString('vi-VN', {
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

  const grouped = useMemo(() => groupByLocalDay(sessions), [sessions]);
  const todayYmd = useMemo(() => getGymZoneTodayIsoDate(), []);

  return (
    <div className="mcs-cal">
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <div className="mcs-cal-scroll" role="grid" aria-label="Lịch phụ trách">
          <div className="mcs-cal-table" role="rowgroup">
            <div className="mcs-cal-head" role="row">
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
            <div className="mcs-cal-body" role="rowgroup">
              {days.map((day) => {
                const daySessions = grouped.get(day.ymd) || [];
                return (
                  <div
                    key={`c-${day.ymd}`}
                    className={`mcs-cal-cell${day.ymd === todayYmd ? ' mcs-cal-today' : ''}`}
                    role="cell"
                  >
                    {daySessions.length === 0 ? (
                      <div className="mcs-cal-empty">Không có buổi tập</div>
                    ) : (
                      daySessions.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          onClick={() => onSelect(s)}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!loading && sessions.length === 0 ? (
        <EmptyState
          title="Tuần này bạn không có buổi dạy nào"
          message="Hãy thử chuyển sang tuần khác."
        />
      ) : null}
    </div>
  );
}

// ----- Một buổi tập trong lưới (bấm để xem chi tiết) -----
function SessionCard({ session, onClick }) {
  const s = session;
  const info = SESSION_STATUS_LABELS[s.status];
  return (
    <button
      type="button"
      className="mcs-cal-session mcs-cal-session-btn text-reset"
      onClick={onClick}
      aria-label={`Xem chi tiết ${s.className || 'buổi tập'}`}
    >
      <div className="mcs-cal-session-time">
        {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
      </div>
      <div className="mcs-cal-session-class">{s.className || '—'}</div>
      <div className="mcs-cal-session-meta">
        <span>{s.roomName || '—'}</span>
        <span> · </span>
        <span>Tối đa {s.capacity}</span>
      </div>
      <div className="mcs-cal-session-foot">
        {s.classType ? (
          <span className="badge mcs-pill-sm bg-danger-subtle text-danger-emphasis">
            {CLASS_TYPE_LABEL[s.classType] || s.classType}
          </span>
        ) : null}
        <Badge bg={info?.variant ?? 'secondary'} className="mcs-pill-sm">
          {info?.text ?? s.status}
        </Badge>
      </div>
    </button>
  );
}
