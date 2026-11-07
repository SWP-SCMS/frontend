import { SESSION_SLOTS } from '../../../utils/sessionSlots';
import Badge from '../../../components/common/SystemBadge';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import EmptyState from '../../../components/common/EmptyState';
import { DateInput } from '../../../components/common/DateInput';
import { getGymLocalIsoDate, gymLocalDateToIsoInstant } from '../../../utils/gymTime';
const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
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

const WEEKDAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

export default function CalendarView({
  loading,
  sessions,
  fetchedPages,
  totalPages,
  totalElements,
  weekRange,
  statusLabel,
  statusBadge,
  classNameById,
  coachNameById,
  roomNameById,
  selectedYmd,
  onSelectDate,
  onPrev,
  onNext,
  onToday,
  sessionBrowserFrom,
  showCancelled,
}) {
  const days = useMemo(() => {
    if (!weekRange) return [];
    const monday = new Date(`${weekRange.mondayYmd}T12:00:00+07:00`);
    if (Number.isNaN(monday.getTime())) return [];
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      // DD/MM in the gym zone for the column header.
      const dayMonth = d.toLocaleDateString('vi-VN', {
        timeZone: GYM_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
      });
      out.push({
        ymd: getGymLocalIsoDate(d.toISOString()),
        dayMonth,
        weekday: WEEKDAY_LABELS[i],
      });
    }
    return out;
  }, [weekRange]);

  const visibleSessions = useMemo(
    () =>
      showCancelled
        ? sessions || []
        : (sessions || []).filter(
            (session) => session?.status !== 'CANCELLED',
          ),
    [sessions, showCancelled],
  );

  const grouped = useMemo(
    () => groupByLocalDay(visibleSessions),
    [visibleSessions],
  );

  const startTimeKey = (value) => new Date(value).toLocaleTimeString('en-GB', {
    timeZone: GYM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const sessionKey = session => `${startTimeKey(session.startTime)}-${startTimeKey(session.endTime)}`;
  const slotRows = SESSION_SLOTS.map(slot => ({ ...slot, key: `${slot.start}-${slot.end}` }));
  const known = new Set(slotRows.map(slot => slot.key));
  const legacy = new Map();
  for (const day of days) {
    for (const session of grouped.get(day.ymd) || []) {
      const key = sessionKey(session);
      if (!known.has(key)) legacy.set(key, { key, start: startTimeKey(session.startTime), end: startTimeKey(session.endTime), label: 'Ngoài slot' });
    }
  }
  const timeRows = [...slotRows, ...legacy.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const [expandedCells, setExpandedCells] = useState(new Set());

  const fullyLoaded =
    !loading &&
    totalPages > 0 &&
    fetchedPages >= totalPages &&
    sessions.length >= totalElements;

  // Display label: the Monday (inclusive) through Sunday (inclusive),
  // NOT including the next-Monday exclusive BE bound. The BE query
  // range stays Monday 00:00 → next Monday 00:00 (exclusive) — the
  // visible week however ends at the displayed week's Sunday.
  const headerLabel = useMemo(() => {
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

  // YYYY-MM-DD for "today" in the gym zone — used to subtly highlight
  // today's column when it belongs to the displayed week.
  const [todayYmd] = useState(() => {
    const now = new Date();
    if (Number.isNaN(now.getTime())) return '';
    return now.toLocaleDateString('en-CA', {
      timeZone: GYM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  });

  return (
    <div className="msl-cal">
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-2 gap-2">
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <Button variant="outline-danger" size="sm" onClick={onPrev}>
            ‹ Tuần trước
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={onToday}>
            Hôm nay
          </Button>
          <Button variant="outline-danger" size="sm" onClick={onNext}>
            Tuần sau ›
          </Button>
          <div className="d-flex align-items-center gap-1">
            <Form.Label
              htmlFor="msl-cal-pick"
              className="small text-muted mb-0"
            >
              Chọn ngày
            </Form.Label>
            <DateInput
              id="msl-cal-pick"
              size="sm"
              value={selectedYmd || ''}
              onChange={(value) => onSelectDate?.(value)}
              aria-label="Chọn ngày để chuyển tuần"
            />
          </div>
        </div>
        <div className="text-muted small">
          {headerLabel}
          {!fullyLoaded && totalElements > 0
            ? ` — đã tải ${sessions.length}/${totalElements} buổi tập`
            : null}
        </div>
      </div>
      {loading && (sessions || []).length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <div
          className="msl-cal-scroll"
          role="grid"
          aria-label="Lịch tuần"
        >
          <div className="msl-cal-table">
            <div className="msl-cal-head" role="row">
              <div className="msl-cal-head-cell msl-cal-time-heading" role="columnheader">Khung giờ</div>
              {days.map((day) => {
                const isToday = day.ymd === todayYmd;
                const isSelected = selectedYmd === day.ymd;
                const headClasses = [
                  'msl-cal-head-cell',
                  isToday ? 'msl-cal-today' : '',
                  isSelected ? 'msl-cal-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={`h-${day.ymd}`}
                    className={headClasses}
                    role="columnheader"
                  >
                    <div className="msl-cal-weekday">{day.weekday}</div>
                    <div className="msl-cal-daymonth">{day.dayMonth}</div>
                  </div>
                );
              })}
            </div>
            {timeRows.map(time => (
            <div className="msl-cal-body" role="row" key={time.key} data-start-time={time.start}>
              <div className="msl-cal-time-label" role="rowheader"><div>{time.label}</div><small>{time.start}–{time.end}</small></div>
              {days.map((day) => {
                const daySessions = (grouped.get(day.ymd) || [])
                  .filter(session => sessionKey(session) === time.key)
                  .toSorted((a, b) => Date.parse(a.endTime) - Date.parse(b.endTime) || String(a.id).localeCompare(String(b.id)));
                const isToday = day.ymd === todayYmd;
                const isSelected = selectedYmd === day.ymd;
                const cellKey = `${day.ymd}-${time.key}`;
                const expanded = expandedCells.has(cellKey);
                const cellClasses = [
                  'msl-cal-cell',
                  isToday ? 'msl-cal-today' : '',
                  isSelected ? 'msl-cal-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={`c-${day.ymd}`}
                    className={cellClasses}
                    role="gridcell"
                  >
                    {daySessions.length === 0 ? (
                      <div className="msl-cal-empty">
                        <span aria-label="Không có buổi tập">—</span>
                      </div>
                    ) : (
                      daySessions.slice(0, expanded ? undefined : 1).map((s) => {
                        const status = s?.status || '—';
                        const className =
                          s?.classId
                            ? (classNameById.get(s.classId) || '—')
                            : '—';
                        const coachName =
                          s?.coachId
                            ? (coachNameById.get(s.coachId) || '—')
                            : '—';
                        const roomName =
                          s?.roomId
                            ? (roomNameById.get(s.roomId) || '—')
                            : '—';
                        return (
                          <Link
                            key={s.id}
                            to={`/manager/class-sessions/${s.id}`}
                            state={
                              sessionBrowserFrom
                                ? { from: sessionBrowserFrom }
                                : undefined
                            }
                            className="msl-cal-session text-reset text-decoration-none"
                          >
                            <div className="msl-cal-session-class">
                              {className}
                            </div>
                            <div className="msl-cal-session-meta">
                              {coachName} · {roomName}
                            </div>
                            <div className="small">{s.bookedCount ?? '—'} / {s.capacity ?? '—'} đã đặt</div>
                            <div className="msl-cal-session-status">
                              <Badge
                                className={`badge ${statusBadge[status] || 'bg-light text-dark'}`}
                              >
                                {statusLabel[status] || status}
                              </Badge>
                            </div>
                          </Link>
                        );
                      })
                    )}
                    {daySessions.length > 1 && <Button size="sm" variant="outline-secondary" className="msl-cal-expand" aria-expanded={expanded} aria-label={`${expanded ? 'Thu gọn' : 'Xem tất cả'} ${daySessions.length} lớp, ${day.weekday} ${day.dayMonth}, ${time.label} ${time.start}`} onClick={() => setExpandedCells(current => {
                      const next = new Set(current); if (expanded) next.delete(cellKey); else next.add(cellKey); return next;
                    })}>{expanded ? 'Thu gọn ▴' : `Xem tất cả ${daySessions.length} lớp ▾`}</Button>}
                  </div>
                );
              })}
            </div>
            ))}
          </div>
        </div>
      )}
      {!loading && visibleSessions.length === 0 ? (
        <EmptyState
          title="Không có buổi tập trong tuần này"
          message="Hãy thử tuần khác hoặc bỏ bộ lọc."
        />
      ) : null}
    </div>
  );
}
