// Member – View Class Schedule (US32).
//
// Read-only Member browser over GET /api/v1/members/class-sessions.
//
// Two presentation modes selected via ?view (search param):
//   - calendar (default): 7-day week grid, gym-local, Monday-to-next-Monday.
//     Fetches EVERY backend page for the bounded week (size=100 max) so a
//     busy week is NEVER silently truncated.
//   - list: paginated table, default page 0, size 20 (BE-enforced cap).
//
// Filters (backend-supported, all passed through):
//   List view:   from, to           (gym-local YYYY-MM-DD inputs →
//                                   Asia/Ho_Chi_Mnh ISO Instant)
//   Calendar:    visible week only  (no extra URL filters today;
//                                   classId is intentionally not surfaced
//                                   because there is no Member-side
//                                   catalogue GET to populate a dropdown).
//
// Verified wire (MemberClassSessionResponse) already contains:
//   - className, classType, disciplineName, coachName, roomName labels
//   - startTime, endTime Instants
//   - capacity, bookedCount, availableCapacity, status, bookingAvailable
// so US32 issues ZERO N+1 calls and never hits Manager endpoints.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import { listMemberClassSessions } from '../../../services/memberClassSessionService';
import './MemberClassSchedulePage.css';

// Locale-agnostic gym-zone helpers. All display goes through
// Asia/Ho_Chi_Minh; the OS/browser zone MUST NOT affect which day is
// considered "today" for the date picker and calendar header.
const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Backend page-size for the calendar weekly sweep. Equal to the BE's
// hard cap (ClassSessionService accepts 1..100) so a single round-
// trip covers most weeks; the loop continues until every page of
// the bounded week is fetched (no arbitrary page ceiling).
const CALENDAR_PAGE_SIZE = 100;

// Backend default size for list view; matches the BE default.
const LIST_PAGE_SIZE = 20;

// yyyy-MM-dd (HTML <input type="date">).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CLASS_TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1-1',
};

const VIEW_OPTIONS = [
  { value: 'list', label: 'Danh sách' },
  { value: 'calendar', label: 'Lịch' },
];

const WEEKDAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

// ----- Gym-zone "today" anchor -----
// Format the current Date in Asia/Ho_Chi_Minh as YYYY-MM-DD. This is
// ALWAYS a gym-zone value — switching the OS / browser zone does
// NOT change which Vietnamese day is considered "today".
function getGymZoneTodayIsoDate() {
  const now = new Date();
  if (Number.isNaN(now.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // en-CA yields YYYY-MM-DD already.
  return parts;
}

// Format an ISO Instant string as a gym-local date dd/MM/yyyy.
function formatGymDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format an ISO Instant string in Asia/Ho_Chi_Mnh (24h HH:mm).
function formatGymTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Convert a gym-local YYYY-MM-DD + hh:mm (default 00:00) into a
// UTC ISO Instant string anchored at +07:00. This is the boundary
// semantics the BE expects: endTime > from AND startTime < to.
function gymLocalDateToIsoInstant(dateStr, hhmm = '00:00') {
  if (!dateStr || !ISO_DATE_RE.test(dateStr)) return null;
  const [hh, mm] = hhmm.split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }
  const hhStr = String(h).padStart(2, '0');
  const mmStr = String(m).padStart(2, '0');
  const composed = new Date(`${dateStr}T${hhStr}:${mmStr}:00+07:00`);
  if (Number.isNaN(composed.getTime())) return null;
  return composed.toISOString();
}

// Gym-local YYYY-MM-DD for an ISO Instant.
function getGymLocalIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Compute Monday 00:00 and next-Monday 00:00 (gym-local) for the
// week containing the given gym-local YYYY-MM-DD (or "today" if
// omitted / invalid).
function getWeekRangeDates(referenceLocalYmd) {
  const ref =
    referenceLocalYmd && ISO_DATE_RE.test(referenceLocalYmd)
      ? referenceLocalYmd
      : getGymZoneTodayIsoDate();
  // Anchor at 12:00 UTC+07:00 to avoid any TZ / DST ambiguity on
  // day-boundary arithmetic.
  const probe = new Date(`${ref}T12:00:00+07:00`);
  if (Number.isNaN(probe.getTime())) return null;

  // Day-of-week in gym-zone, 0=Sun..6=Sat.
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'short',
  }).format(probe);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd];
  if (dow == null) return null;
  // Move backwards to Monday: (dow + 6) % 7 days.
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(probe.getTime());
  monday.setUTCDate(monday.getUTCDate() - offsetToMonday);
  const nextMonday = new Date(monday.getTime());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return {
    mondayYmd: getGymLocalIsoDate(monday.toISOString()),
    nextMondayYmd: getGymLocalIsoDate(nextMonday.toISOString()),
  };
}

// Group Sessions by gym-local date (YYYY-MM-DD).
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

// ---- URL search-param helpers ----
function readStringParam(params, name) {
  const v = params.get(name);
  return v == null ? '' : v;
}

function readIntParam(params, name) {
  const v = params.get(name);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function MemberClassSchedulePage() {
  const [params, setParams] = useSearchParams();

  // URL state.
  const view = readStringParam(params, 'view') === 'list' ? 'list' : 'calendar';
  const fromYmd = readStringParam(params, 'from');
  const toYmd = readStringParam(params, 'to');
  const listPage = readIntParam(params, 'page') ?? 0;
  const calYmd = readStringParam(params, 'week') || getGymZoneTodayIsoDate();

  // ----- List-view state -----
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(listPage);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ----- Calendar-view state -----
  const [calSessions, setCalSessions] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState(null);
  const [calFetchedPages, setCalFetchedPages] = useState(0);
  const [calTotalPages, setCalTotalPages] = useState(0);
  const [calTotalElements, setCalTotalElements] = useState(0);

  // Convert the list-mode YYYY-MM-DD inputs into BE Instants only
  // when at least one end is set. invalid=true triggers the
  // EmptyState — never sends to the BE.
  const listRangeIso = useMemo(() => {
    if (!fromYmd && !toYmd) return null;
    const fromIso = fromYmd ? gymLocalDateToIsoInstant(fromYmd, '00:00') : null;
    const toIso = toYmd ? gymLocalDateToIsoInstant(toYmd, '00:00') : null;
    if (fromIso && toIso && !(toIso > fromIso)) {
      return { invalid: true, fromIso, toIso };
    }
    return { invalid: false, fromIso, toIso };
  }, [fromYmd, toYmd]);

  // Compute the visible week's Monday / next-Monday Instants.
  const weekRange = useMemo(() => getWeekRangeDates(calYmd), [calYmd]);
  const weekRangeIso = useMemo(() => {
    if (!weekRange) return null;
    const fromIso = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    const toIso = gymLocalDateToIsoInstant(weekRange.nextMondayYmd, '00:00');
    if (!fromIso || !toIso) return null;
    return { fromIso, toIso };
  }, [weekRange]);

  // ----- List-view data fetch -----
  useEffect(() => {
    if (view !== 'list') return undefined;
    if (listRangeIso?.invalid) {
      setSessions([]);
      setTotalElements(0);
      setTotalPages(0);
      setLoading(false);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const paramsForBe = {
      page: listPage,
      size: LIST_PAGE_SIZE,
    };
    if (listRangeIso?.fromIso) paramsForBe.from = listRangeIso.fromIso;
    if (listRangeIso?.toIso) paramsForBe.to = listRangeIso.toIso;
    listMemberClassSessions(paramsForBe)
      .then((data) => {
        if (cancelled) return;
        setSessions(Array.isArray(data?.content) ? data.content : []);
        setPage(typeof data?.page === 'number' ? data.page : listPage);
        setTotalElements(
          typeof data?.totalElements === 'number' ? data.totalElements : 0,
        );
        setTotalPages(
          typeof data?.totalPages === 'number' ? data.totalPages : 0,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, listPage, listRangeIso]);

  // ----- Calendar-view data fetch (every page of the bounded week) -----
  useEffect(() => {
    if (view !== 'calendar') return undefined;
    if (!weekRangeIso) {
      setCalSessions([]);
      setCalFetchedPages(0);
      setCalTotalPages(0);
      setCalTotalElements(0);
      setCalLoading(false);
      setCalError(null);
      return undefined;
    }
    let cancelled = false;
    setCalLoading(true);
    setCalError(null);
    setCalSessions([]);
    setCalFetchedPages(0);
    setCalTotalPages(0);
    setCalTotalElements(0);

    (async () => {
      try {
        const aggregated = [];
        let pageIdx = 0;
        // Fetch every backend page for this bounded week. The loop
        // stops naturally when pageIdx >= totalPages OR when the
        // accumulated content already covers totalElements. There
        // is intentionally NO arbitrary page ceiling (correction
        // #2 of the spec): a busy week must never be silently
        // truncated.
        for (;;) {
          const data = await listMemberClassSessions({
            from: weekRangeIso.fromIso,
            to: weekRangeIso.toIso,
            page: pageIdx,
            size: CALENDAR_PAGE_SIZE,
          });
          if (cancelled) return;
          const content = Array.isArray(data?.content) ? data.content : [];
          aggregated.push(...content);
          const totalPages =
            typeof data?.totalPages === 'number' ? data.totalPages : 0;
          const totalElements =
            typeof data?.totalElements === 'number' ? data.totalElements : 0;
          if (cancelled) return;
          setCalFetchedPages(pageIdx + 1);
          setCalTotalPages(totalPages);
          setCalTotalElements(totalElements);
          setCalSessions([...aggregated]);
          // Natural stop conditions.
          if (totalPages > 0 && pageIdx + 1 >= totalPages) break;
          if (aggregated.length >= totalElements && totalElements > 0) break;
          // Defensive: BE returned less than a full page AND no more
          // elements to expect — stop.
          if (content.length === 0) break;
          pageIdx += 1;
        }
      } catch (err) {
        if (cancelled) return;
        setCalError(err);
      } finally {
        if (!cancelled) setCalLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [view, weekRangeIso]);

  // ----- URL-param writers -----
  const setView = useCallback(
    (next) => {
      const next2 = new URLSearchParams(params);
      // Calendar is the default; only persist `view` when List is
      // explicitly chosen to keep canonical URLs clean.
      if (next === 'list') next2.set('view', 'list');
      else next2.delete('view');
      if (next === 'calendar') {
        next2.delete('page');
        next2.delete('from');
        next2.delete('to');
        if (!next2.get('week')) next2.set('week', getGymZoneTodayIsoDate());
      } else {
        next2.delete('week');
      }
      setParams(next2, { replace: true });
    },
    [params, setParams],
  );

  const setListPage = useCallback(
    (next) => {
      const next2 = new URLSearchParams(params);
      if (next <= 0) next2.delete('page');
      else next2.set('page', String(next));
      setParams(next2, { replace: true });
    },
    [params, setParams],
  );

  const onFilterChange = useCallback(
    (name, value) => {
      const next = new URLSearchParams(params);
      if (value === '' || value == null) next.delete(name);
      else next.set(name, value);
      next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearListFilters = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('from');
    next.delete('to');
    next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const shiftCalendarWeek = useCallback(
    (delta) => {
      const ref = new Date(`${calYmd}T12:00:00+07:00`);
      if (Number.isNaN(ref.getTime())) return;
      ref.setUTCDate(ref.getUTCDate() + delta * 7);
      const newYmd = getGymLocalIsoDate(ref.toISOString());
      if (!newYmd) return;
      const next = new URLSearchParams(params);
      next.set('week', newYmd);
      setParams(next, { replace: true });
    },
    [calYmd, params, setParams],
  );

  const gotoCurrentWeek = useCallback(() => {
    const today = getGymZoneTodayIsoDate();
    const next = new URLSearchParams(params);
    next.set('week', today);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const gotoCalDate = useCallback(
    (ymd) => {
      if (!ymd || !ISO_DATE_RE.test(ymd)) return;
      const next = new URLSearchParams(params);
      next.set('week', ymd);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const listFiltersActive = Boolean(fromYmd) || Boolean(toYmd);
  const safePage = Math.max(0, page | 0);
  const safeTotalPages = Math.max(0, totalPages | 0);
  const pageDisplay = safeTotalPages > 0 ? safePage + 1 : 0;

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Lịch lớp</h1>
          <p className="text-muted mb-0">
            Tra cứu các buổi tập sắp tới cùng lịch học, huấn luyện
            viên, phòng tập và số chỗ còn lại.
          </p>
        </div>
        <ButtonGroup size="sm" aria-label="Chế độ hiển thị">
          {VIEW_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={view === opt.value ? 'danger' : 'outline-danger'}
              onClick={() => setView(opt.value)}
              aria-pressed={view === opt.value}
            >
              {opt.label}
            </Button>
          ))}
        </ButtonGroup>
      </header>

      {/* ----- Per-view filter / nav row ----- */}
      {view === 'list' ? (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col md={3} sm={6}>
                <Form.Label className="small text-muted mb-1">
                  Từ ngày (giờ địa phương)
                </Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={fromYmd}
                  onChange={(e) => onFilterChange('from', e.target.value)}
                />
              </Col>
              <Col md={3} sm={6}>
                <Form.Label className="small text-muted mb-1">
                  Đến ngày (giờ địa phương)
                </Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={toYmd}
                  onChange={(e) => onFilterChange('to', e.target.value)}
                />
                {listRangeIso?.invalid ? (
                  <Form.Text className="text-danger">
                    Ngày kết thúc phải sau ngày bắt đầu.
                  </Form.Text>
                ) : null}
              </Col>
              <Col md={6} sm={12} className="d-flex justify-content-end">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={clearListFilters}
                  disabled={!listFiltersActive}
                >
                  Bỏ bộ lọc
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ) : (
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
                onClick={gotoCurrentWeek}
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
                <Form.Label
                  htmlFor="mcs-cal-pick"
                  className="small text-muted mb-0"
                >
                  Chọn ngày
                </Form.Label>
                <Form.Control
                  id="mcs-cal-pick"
                  type="date"
                  size="sm"
                  value={calYmd}
                  onChange={(e) => gotoCalDate(e.target.value)}
                  aria-label="Chọn ngày để chuyển tuần"
                />
              </div>
            </div>
            <CalendarHeaderLabel weekRange={weekRange} />
          </Card.Body>
        </Card>
      )}

      {/* ----- API failure ----- */}
      <ErrorAlert
        error={view === 'list' ? error : calError}
        title={
          view === 'list'
            ? 'Không tải được lịch buổi tập'
            : 'Không tải được lịch tuần'
        }
        onClose={
          view === 'list'
            ? error?.response
              ? () => setError(null)
              : undefined
            : calError?.response
              ? () => setCalError(null)
              : undefined
        }
      />

      {/* ----- LIST VIEW ----- */}
      {view === 'list' ? (
        <ListView
          loading={loading}
          sessions={sessions}
          totalElements={totalElements}
          page={safePage}
          pageDisplay={pageDisplay}
          totalPages={safeTotalPages}
          listRangeInvalid={Boolean(listRangeIso?.invalid)}
          listFiltersActive={listFiltersActive}
          onClearFilters={clearListFilters}
          onPrev={() => setListPage(Math.max(0, safePage - 1))}
          onNext={() => setListPage(safePage + 1)}
        />
      ) : null}

      {/* ----- CALENDAR VIEW ----- */}
      {view === 'calendar' ? (
        <CalendarView
          loading={calLoading}
          sessions={calSessions}
          fetchedPages={calFetchedPages}
          totalPages={calTotalPages}
          totalElements={calTotalElements}
          weekRange={weekRange}
        />
      ) : null}
    </div>
  );
}

// ----- Calendar header label (Monday → Sunday, gym-zone) -----
function CalendarHeaderLabel({ weekRange }) {
  const label = useMemo(() => {
    if (!weekRange) return '';
    const mondayIso = gymLocalDateToIsoInstant(
      weekRange.mondayYmd,
      '00:00',
    );
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

// ----- List subcomponent -----
function ListView({
  loading,
  sessions,
  totalElements,
  page,
  pageDisplay,
  totalPages,
  listRangeInvalid,
  listFiltersActive,
  onClearFilters,
  onPrev,
  onNext,
}) {
  const hasSessions = (sessions || []).length > 0;
  const safeTotalPages = Math.max(0, totalPages | 0);

  let body;
  if (loading) {
    body = (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  } else if (listRangeInvalid) {
    body = (
      <EmptyState
        title="Khoảng ngày không hợp lệ"
        message="Ngày kết thúc phải sau ngày bắt đầu."
      />
    );
  } else if (!hasSessions) {
    body = (
      <EmptyState
        title={
          listFiltersActive
            ? 'Không có buổi tập phù hợp'
            : 'Chưa có buổi tập'
        }
        message={
          listFiltersActive
            ? 'Thử bỏ bộ lọc hoặc đổi khoảng ngày.'
            : 'Hệ thống chưa ghi nhận buổi tập nào.'
        }
        action={
          listFiltersActive ? (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={onClearFilters}
            >
              Bỏ bộ lọc
            </Button>
          ) : null
        }
      />
    );
  } else {
    body = (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Ngày</th>
            <th>Thời gian</th>
            <th>Lớp học</th>
            <th>Bộ môn</th>
            <th>Huấn luyện viên</th>
            <th>Phòng tập</th>
            <th>Chỗ còn lại</th>
          </tr>
        </thead>
        <tbody>
          {(sessions || []).map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </tbody>
      </Table>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="table-responsive">{body}</div>
      <div className="px-3 py-2 border-top d-flex flex-wrap justify-content-between align-items-center text-muted small">
        <div>
          {!loading && totalElements > 0
            ? `Hiển thị ${sessions.length} trong tổng số ${totalElements} buổi tập (trang ${pageDisplay}/${Math.max(1, safeTotalPages)})`
            : null}
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onPrev}
            disabled={loading || page <= 0}
          >
            ‹ Trang trước
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onNext}
            disabled={loading || safeTotalPages <= 0 || page + 1 >= safeTotalPages}
          >
            Trang sau ›
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- Calendar subcomponent -----
function CalendarView({
  loading,
  sessions,
  fetchedPages,
  totalPages,
  totalElements,
  weekRange,
}) {
  const days = useMemo(() => {
    if (!weekRange) return [];
    const monday = new Date(`${weekRange.mondayYmd}T12:00:00+07:00`);
    if (Number.isNaN(monday.getTime())) return [];
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday.getTime());
      d.setUTCDate(d.getUTCDate() + i);
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

  const grouped = useMemo(() => groupByLocalDay(sessions || []), [sessions]);

  const fullyLoaded =
    !loading &&
    totalPages > 0 &&
    fetchedPages >= totalPages &&
    sessions.length >= totalElements;

  // YYYY-MM-DD for "today" in the gym zone — gym-zone anchor, NEVER
  // browser-local.
  const todayYmd = useMemo(() => getGymZoneTodayIsoDate(), []);

  return (
    <div className="mcs-cal">
      {loading && (sessions || []).length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <div
          className="mcs-cal-scroll"
          role="grid"
          aria-label="Lịch tuần"
        >
          <div className="mcs-cal-table" role="rowgroup">
            <div className="mcs-cal-head" role="row">
              {days.map((day) => {
                const isToday = day.ymd === todayYmd;
                const headClasses = [
                  'mcs-cal-head-cell',
                  isToday ? 'mcs-cal-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={`h-${day.ymd}`}
                    className={headClasses}
                    role="columnheader"
                  >
                    <div className="mcs-cal-weekday">{day.weekday}</div>
                    <div className="mcs-cal-daymonth">{day.dayMonth}</div>
                  </div>
                );
              })}
            </div>
            <div className="mcs-cal-body" role="rowgroup">
              {days.map((day) => {
                const daySessions = grouped.get(day.ymd) || [];
                const isToday = day.ymd === todayYmd;
                const cellClasses = [
                  'mcs-cal-cell',
                  isToday ? 'mcs-cal-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={`c-${day.ymd}`}
                    className={cellClasses}
                    role="cell"
                  >
                    {daySessions.length === 0 ? (
                      <div className="mcs-cal-empty">Không có buổi tập</div>
                    ) : (
                      daySessions.map((s) => (
                        <SessionCard key={s.id} session={s} />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!loading && totalElements > 0 && !fullyLoaded ? (
        <div className="text-muted small text-end mt-1">
          Đã tải {sessions.length}/{totalElements} buổi tập
        </div>
      ) : null}
      {!loading && (sessions || []).length === 0 ? (
        <EmptyState
          title="Tuần này chưa có buổi tập"
          message="Hãy thử tuần khác."
        />
      ) : null}
    </div>
  );
}

// ----- A single Session row in the List view -----
function SessionRow({ session }) {
  const s = session || {};
  return (
    <tr>
      <td>{formatGymDate(s.startTime)}</td>
      <td>
        {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
      </td>
      <td>
        <div className="fw-semibold">{s.className || '—'}</div>
        <ClassTypePill classType={s.classType} />
      </td>
      <td>{s.disciplineName || '—'}</td>
      <td>{s.coachName || '—'}</td>
      <td>{s.roomName || '—'}</td>
      <td>
        <CapacityChip
          availableCapacity={s.availableCapacity}
          bookingAvailable={s.bookingAvailable}
        />
      </td>
    </tr>
  );
}

// ----- A single Session card in the Calendar view -----
function SessionCard({ session }) {
  const s = session || {};
  return (
    <div className="mcs-cal-session text-reset">
      <div className="mcs-cal-session-time">
        {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
      </div>
      <div className="mcs-cal-session-class">
        {s.className || '—'}
      </div>
      <div className="mcs-cal-session-meta">
        <span>{s.coachName || '—'}</span>
        <span> · </span>
        <span>{s.roomName || '—'}</span>
      </div>
      <div className="mcs-cal-session-foot">
        <ClassTypePill classType={s.classType} small />
        <CapacityChip
          availableCapacity={s.availableCapacity}
          bookingAvailable={s.bookingAvailable}
        />
      </div>
    </div>
  );
}

// ----- Vietnamese classType pill -----
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

// ----- Authoritative availability chip (uses the BE-computed
// availableCapacity verbatim; never recomputes on the FE). -----
function CapacityChip({ availableCapacity, bookingAvailable }) {
  const avail =
    typeof availableCapacity === 'number' ? availableCapacity : null;
  let chip;
  if (avail != null && avail <= 0) {
    chip = <span className="badge bg-secondary">Hết chỗ</span>;
  } else if (avail != null) {
    chip = (
      <span className="badge bg-success-subtle text-success-emphasis">
        Còn {avail} chỗ
      </span>
    );
  } else {
    chip = <span className="badge bg-light text-dark">—</span>;
  }
  if (bookingAvailable === true) {
    return (
      <span className="d-inline-flex flex-column align-items-start gap-1">
        {chip}
        <span className="text-muted small">(Có thể đặt chỗ)</span>
      </span>
    );
  }
  return chip;
}
