// Manager – Session List / Calendar (US28).
//
// Read-only manager browser over GET /api/v1/manager/class-sessions.
//
// Two presentation modes selected via ?view (search param):
//   - list:    paginated table, default page 0, size 20 (BE-enforced cap).
//   - calendar: 7-day week grid, gym-local, Monday-to-next-Monday. Fetches
//              every backend page for the bounded week (size=100 max) so a
//              busy week is NEVER silently truncated.
//
// Filters (all backend-supported, passed straight through):
//   ?status, ?classId, ?coachId, ?roomId, ?from, ?to
//   List date-range inputs are gym-local YYYY-MM-DD that we convert to
//   ISO Instants in Asia/Ho_Chi_Minh before sending to the BE.
//
// The wire contains only IDs for class/coach/room — names are resolved
// via listClasses() / listRooms() / searchStaffAccounts() (US23 / US24
// / US25 / US05-08 services). Coach names are fetched across ALL pages
// (no ACTIVE filter), so historical Sessions belonging to inactive
// Coaches still resolve. No per-row GETs — labels are looked up via
// in-memory maps built once per page load.

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
import { listClasses } from '../../../services/sportClassService';
import { listRooms } from '../../../services/roomService';
import { searchStaffAccounts } from '../../../services/staffAccountService';
import {
  listManagerSessions,
} from '../../../services/classSessionService';
import './ManagerSessionListPage.css';

// BE-enforced page size cap for staff-accounts (1..100).
const COACH_PAGE_SIZE = 100;
// Defensive upper bound: stop after this many pages of coaches.
const COACH_MAX_PAGES = 50;

// List-view default page size. The BE default is 20; we keep
// the same default so the truncation behavior is identical to the
// BE's own defaults.
const LIST_PAGE_SIZE = 20;
// Calendar-view fetch size: BE-allowed max, so a single page is
// the smallest number of round-trips for typical weeks.
const CALENDAR_PAGE_SIZE = 100;

// yyyy-MM-dd (HTML <input type="date">).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Locale-agnostic helpers — every display goes through `Asia/Ho_Chi_Minh`.
const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'SCHEDULED', label: 'Đã lên lịch' },
  { value: 'IN_PROGRESS', label: 'Đang diễn ra' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

const STATUS_BADGE = {
  SCHEDULED: 'bg-primary-subtle text-primary-emphasis',
  IN_PROGRESS: 'bg-warning-subtle text-warning-emphasis',
  COMPLETED: 'bg-success-subtle text-success-emphasis',
  CANCELLED: 'bg-secondary-subtle text-secondary-emphasis',
};

const STATUS_LABEL = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const VIEW_OPTIONS = [
  { value: 'list', label: 'Danh sách' },
  { value: 'calendar', label: 'Lịch' },
];

// ----- Date / time helpers (gym-zone, browser-independent) -----

// Today in the browser's local zone, formatted as YYYY-MM-DD. The
// date inputs use the user's local zone as the input contract; the
// boundary Instants we send to the BE are explicitly anchored at
// UTC+07:00.
function getLocalTodayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Format an ISO Instant string in Asia/Ho_Chi_Minh.
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

// Day-of-week (0=Sun..6=Sat) for an ISO Instant, gym-local.
function getGymLocalDayOfWeek(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Use Intl to extract the gym-local weekday.
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'short',
  }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? null;
}

// Gym-local YYYY-MM-DD for an ISO Instant.
function getGymLocalIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  // en-CA yields YYYY-MM-DD already.
  return parts;
}

// Convert a gym-local YYYY-MM-DD + 00:00 (or 24:00 for the upper
// bound) into an ISO Instant string anchored at UTC+07:00. This is
// the boundary semantics the BE expects:
//   [from, to) over the Session interval — endTime > from AND startTime < to.
function gymLocalDateToIsoInstant(dateStr, hhmm) {
  if (!dateStr || !ISO_DATE_RE.test(dateStr)) return null;
  const [hh, mm] = (hhmm || '00:00').split(':');
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

// Compute Monday 00:00 and next-Monday 00:00 (gym-local) for the
// week containing the given gym-local date string. Returns the two
// gym-local YYYY-MM-DD strings.
function getWeekRangeDates(referenceLocalYmd) {
  const ref = referenceLocalYmd && ISO_DATE_RE.test(referenceLocalYmd)
    ? referenceLocalYmd
    : getLocalTodayIsoDate();
  // Anchor at UTC noon to avoid any TZ-DST edge ambiguity.
  const probe = new Date(`${ref}T12:00:00+07:00`);
  if (Number.isNaN(probe.getTime())) {
    return null;
  }
  // Day-of-week in gym-zone, 0=Sun..6=Sat.
  const wd = getGymLocalDayOfWeek(probe.toISOString());
  if (wd == null) return null;
  // Move backwards to Monday: (wd + 6) % 7 days.
  const offsetToMonday = (wd + 6) % 7;
  const monday = new Date(probe.getTime());
  monday.setUTCDate(monday.getUTCDate() - offsetToMonday);
  const nextMonday = new Date(monday.getTime());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return {
    mondayYmd: getGymLocalIsoDate(monday.toISOString()),
    nextMondayYmd: getGymLocalIsoDate(nextMonday.toISOString()),
  };
}

// ----- Coach bulk fetch (no N+1, no first-page truncation) -----
async function fetchAllCoaches() {
  const aggregated = [];
  let page = 0;
  while (page < COACH_MAX_PAGES) {
    const result = await searchStaffAccounts({
      role: 'COACH',
      page,
      size: COACH_PAGE_SIZE,
    });
    const content = Array.isArray(result?.content) ? result.content : [];
    aggregated.push(...content);
    const totalPages = Number(result?.totalPages) || 0;
    const totalElements = Number(result?.totalElements) || aggregated.length;
    if (aggregated.length >= totalElements) break;
    if (content.length === 0) break;
    if (totalPages > 0 && page + 1 >= totalPages) break;
    page += 1;
  }
  return aggregated;
}

// ----- URL search-param helpers -----
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

// ----- Bulk lookup maps for Class / Coach / Room names -----
function buildClassNameMap(classes) {
  const m = new Map();
  for (const c of classes || []) {
    if (c && c.id) m.set(c.id, c.name || '—');
  }
  return m;
}

function buildRoomNameMap(rooms) {
  const m = new Map();
  for (const r of rooms || []) {
    if (r && r.id) m.set(r.id, r.name || '—');
  }
  return m;
}

function buildCoachNameMap(accounts) {
  const m = new Map();
  for (const a of accounts || []) {
    if (a && a.accountId) {
      m.set(a.accountId, a.fullName || a.email || '—');
    }
  }
  return m;
}

// ----- Group Sessions by gym-local date (YYYY-MM-DD) -----
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

// ----- The page -----
export default function ManagerSessionListPage() {
  const [params, setParams] = useSearchParams();

  // Read URL state. Default to Calendar so that visiting
  // /manager/class-sessions with no `view` param lands on Calendar;
  // explicit `?view=list` still shows List, `?view=calendar` shows
  // Calendar. Any other value falls back to Calendar.
  const view = readStringParam(params, 'view') === 'list' ? 'list' : 'calendar';
  const status = readStringParam(params, 'status');
  const classId = readStringParam(params, 'classId');
  const coachId = readStringParam(params, 'coachId');
  const roomId = readStringParam(params, 'roomId');
  const fromYmd = readStringParam(params, 'from');
  const toYmd = readStringParam(params, 'to');
  const listPage = readIntParam(params, 'page') ?? 0;
  const calYmd = readStringParam(params, 'week') || getLocalTodayIsoDate();

  // ----- Supporting lookups (Class / Room / Coach) -----
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setClassesLoading(true);
    setClassesError(null);
    listClasses()
      .then((data) => {
        if (cancelled) return;
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setClassesError(err);
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRoomsLoading(true);
    setRoomsError(null);
    listRooms()
      .then((data) => {
        if (cancelled) return;
        setRooms(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setRoomsError(err);
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCoachesLoading(true);
    setCoachesError(null);
    fetchAllCoaches()
      .then((result) => {
        if (cancelled) return;
        setCoaches(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setCoachesError(err);
      })
      .finally(() => {
        if (!cancelled) setCoachesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- Bulk lookup maps (computed once per resource load) -----
  const classNameById = useMemo(() => buildClassNameMap(classes), [classes]);
  const roomNameById = useMemo(() => buildRoomNameMap(rooms), [rooms]);
  const coachNameById = useMemo(() => buildCoachNameMap(coaches), [coaches]);

  // ----- Derived select options (sorted, with empty/loading states) -----
  const classOptions = useMemo(() => {
    return (classes || [])
      .map((c) => ({ value: c.id, label: c.name || '—' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  const roomOptions = useMemo(() => {
    return (rooms || [])
      .map((r) => ({ value: r.id, label: r.name || '—' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);

  const coachOptions = useMemo(() => {
    return (coaches || [])
      .map((a) => ({
        value: a.accountId,
        label: a.fullName || a.email || '—',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [coaches]);

  // ----- Session fetch (list vs calendar) -----
  // Common filter parameters passed to BE.
  const baseFilterParams = useMemo(
    () => ({
      classId,
      coachId,
      roomId,
      status,
    }),
    [classId, coachId, roomId, status],
  );

  // List view state (single backend page).
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(listPage);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Calendar view state (concatenated content across all pages of the bounded week).
  const [calSessions, setCalSessions] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState(null);
  const [calFetchedPages, setCalFetchedPages] = useState(0);
  const [calTotalPages, setCalTotalPages] = useState(0);
  const [calTotalElements, setCalTotalElements] = useState(0);

  // Compute list-mode date-range Instants only when both ends are set.
  const listRangeIso = useMemo(() => {
    if (!fromYmd && !toYmd) return null;
    const fromIso = fromYmd ? gymLocalDateToIsoInstant(fromYmd, '00:00') : null;
    const toIso = toYmd ? gymLocalDateToIsoInstant(toYmd, '00:00') : null;
    if (fromIso && toIso && !(toIso > fromIso)) {
      return { invalid: true, fromIso, toIso };
    }
    return { invalid: false, fromIso, toIso };
  }, [fromYmd, toYmd]);

  // Compute calendar-mode week-bound Instants.
  const weekRange = useMemo(() => getWeekRangeDates(calYmd), [calYmd]);
  const weekRangeIso = useMemo(() => {
    if (!weekRange) return null;
    const fromIso = gymLocalDateToIsoInstant(weekRange.mondayYmd, '00:00');
    const toIso = gymLocalDateToIsoInstant(weekRange.nextMondayYmd, '00:00');
    if (!fromIso || !toIso) return null;
    return { fromIso, toIso };
  }, [weekRange]);

  // Whenever list-mode URL state changes, refetch the list page.
  useEffect(() => {
    if (view !== 'list') return undefined;
    // Suppress request when the list-range is invalid (would 400).
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
      ...baseFilterParams,
      page: listPage,
      size: LIST_PAGE_SIZE,
    };
    if (listRangeIso?.fromIso) paramsForBe.from = listRangeIso.fromIso;
    if (listRangeIso?.toIso) paramsForBe.to = listRangeIso.toIso;
    listManagerSessions(paramsForBe)
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
  }, [
    view,
    baseFilterParams,
    listPage,
    listRangeIso,
  ]);

  // Whenever calendar-mode URL state changes, fetch EVERY page of the bounded week.
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
        // Cap on pages for absolute safety; the bounded week guarantees
        // a small upper bound in practice.
        const PAGE_CAP = 50;
        while (pageIdx < PAGE_CAP) {
          const data = await listManagerSessions({
            ...baseFilterParams,
            from: weekRangeIso.fromIso,
            to: weekRangeIso.toIso,
            page: pageIdx,
            size: CALENDAR_PAGE_SIZE,
          });
          if (cancelled) return;
          aggregated.push(...(Array.isArray(data?.content) ? data.content : []));
          const totalPages =
            typeof data?.totalPages === 'number' ? data.totalPages : 0;
          const totalElements =
            typeof data?.totalElements === 'number' ? data.totalElements : 0;
          if (cancelled) return;
          setCalFetchedPages(pageIdx + 1);
          setCalTotalPages(totalPages);
          setCalTotalElements(totalElements);
          setCalSessions([...aggregated]);
          if (totalPages > 0 && pageIdx + 1 >= totalPages) break;
          // Defensive: stop if BE reports no more elements yet totalPages === 0.
          if (aggregated.length >= totalElements) break;
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
  }, [
    view,
    baseFilterParams,
    weekRangeIso,
  ]);

  // ----- URL-param writers -----
  const setView = useCallback(
    (next) => {
      const next2 = new URLSearchParams(params);
      // Calendar is the default; only persist `view` when the user
      // explicitly picks List, so the canonical URL stays clean.
      if (next === 'list') next2.set('view', 'list');
      else next2.delete('view');
      // Reset page (list-only) and any stale list date-range when switching to calendar;
      // remove the calendar `week` and `day` params when switching back to list.
      if (next === 'calendar') {
        next2.delete('page');
        next2.delete('from');
        next2.delete('to');
        if (!next2.get('week')) next2.set('week', getLocalTodayIsoDate());
        if (!next2.get('day')) next2.set('day', getLocalTodayIsoDate());
      } else {
        next2.delete('week');
        next2.delete('day');
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
      // When any filter changes, reset page to 0 to avoid stale
      // paging contexts.
      const next = new URLSearchParams(params);
      if (value === '' || value == null) next.delete(name);
      else next.set(name, value);
      next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearAllFilters = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('status');
    next.delete('classId');
    next.delete('coachId');
    next.delete('roomId');
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
      const next = new URLSearchParams(params);
      if (newYmd) next.set('week', newYmd);
      setParams(next, { replace: true });
    },
    [calYmd, params, setParams],
  );

  const gotoCurrentWeek = useCallback(() => {
    const today = getLocalTodayIsoDate();
    const next = new URLSearchParams(params);
    next.set('week', today);
    next.set('day', today);
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Navigate to the week containing the given gym-local YYYY-MM-DD
  // and mark that day as the selected one. The BE query bounds stay
  // Monday 00:00 → next Monday 00:00 (exclusive) — only the URL
  // navigation state changes here.
  const gotoCalDate = useCallback(
    (ymd) => {
      if (!ymd || !ISO_DATE_RE.test(ymd)) return;
      const next = new URLSearchParams(params);
      next.set('week', ymd);
      next.set('day', ymd);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  // The selected day, if any. When missing or out of range, the
  // CalendarView falls back to today's day in the displayed week.
  const calDayParam = readStringParam(params, 'day');
  const selectedYmd =
    calDayParam && ISO_DATE_RE.test(calDayParam) ? calDayParam : '';

  // ----- Render helpers -----
  const totalFiltersActive =
    Boolean(status) ||
    Boolean(classId) ||
    Boolean(coachId) ||
    Boolean(roomId) ||
    Boolean(fromYmd) ||
    Boolean(toYmd);

  const listTotalPages = totalPages || 0;

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Buổi tập</h1>
          <p className="text-muted mb-0">
            Xem và tra cứu các buổi tập theo lớp, huấn luyện viên,
            phòng tập và trạng thái.
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

      {/* ----- Filter row (common across both views) ----- */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">Trạng thái</Form.Label>
              <Form.Select
                size="sm"
                value={status}
                onChange={(e) => onFilterChange('status', e.target.value)}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value || 'all-status'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">Lớp học</Form.Label>
              <Form.Select
                size="sm"
                value={classId}
                onChange={(e) => onFilterChange('classId', e.target.value)}
                disabled={classesLoading}
              >
                <option value="">
                  {classesLoading ? 'Đang tải…' : '— Tất cả —'}
                </option>
                {classOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">
                Huấn luyện viên
              </Form.Label>
              <Form.Select
                size="sm"
                value={coachId}
                onChange={(e) => onFilterChange('coachId', e.target.value)}
                disabled={coachesLoading}
              >
                <option value="">
                  {coachesLoading ? 'Đang tải…' : '— Tất cả —'}
                </option>
                {coachOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">Phòng tập</Form.Label>
              <Form.Select
                size="sm"
                value={roomId}
                onChange={(e) => onFilterChange('roomId', e.target.value)}
                disabled={roomsLoading}
              >
                <option value="">
                  {roomsLoading ? 'Đang tải…' : '— Tất cả —'}
                </option>
                {roomOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
          {view === 'list' ? (
            <Row className="g-3 align-items-end mt-1">
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
                  onClick={clearAllFilters}
                  disabled={!totalFiltersActive}
                >
                  Bỏ bộ lọc
                </Button>
              </Col>
            </Row>
          ) : (
            <Row className="g-3 align-items-end mt-1">
              <Col xs={12} className="d-flex justify-content-end">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={clearAllFilters}
                  disabled={!totalFiltersActive}
                >
                  Bỏ bộ lọc
                </Button>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* ----- Per-resource lookup errors ----- */}
      {classesError ? (
        <ErrorAlert
          className="mb-2"
          error={classesError}
          title="Không tải được danh sách lớp học"
        />
      ) : null}
      {roomsError ? (
        <ErrorAlert
          className="mb-2"
          error={roomsError}
          title="Không tải được danh sách phòng tập"
        />
      ) : null}
      {coachesError ? (
        <ErrorAlert
          className="mb-2"
          error={coachesError}
          title="Không tải được danh sách huấn luyện viên"
        />
      ) : null}

      {/* ----- Session API failure ----- */}
      <ErrorAlert
        error={view === 'list' ? error : calError}
        title={
          view === 'list'
            ? 'Không tải được danh sách buổi tập'
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
          page={page}
          totalPages={listTotalPages}
          listRangeInvalid={Boolean(listRangeIso?.invalid)}
          formatGymDate={formatGymDate}
          formatGymTime={formatGymTime}
          statusLabel={STATUS_LABEL}
          statusBadge={STATUS_BADGE}
          classNameById={classNameById}
          roomNameById={roomNameById}
          coachNameById={coachNameById}
          onPrev={() => setListPage(Math.max(0, page - 1))}
          onNext={() => setListPage(page + 1)}
          totalFiltersActive={totalFiltersActive}
          onClearFilters={clearAllFilters}
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
          formatGymTime={formatGymTime}
          statusLabel={STATUS_LABEL}
          statusBadge={STATUS_BADGE}
          classNameById={classNameById}
          coachNameById={coachNameById}
          roomNameById={roomNameById}
          selectedYmd={selectedYmd}
          onSelectDate={gotoCalDate}
          onPrev={() => shiftCalendarWeek(-1)}
          onNext={() => shiftCalendarWeek(1)}
          onToday={gotoCurrentWeek}
        />
      ) : null}
    </div>
  );
}

// ----- List subcomponent -----
function ListView({
  loading,
  sessions,
  totalElements,
  page,
  totalPages,
  listRangeInvalid,
  formatGymDate,
  formatGymTime,
  statusLabel,
  statusBadge,
  classNameById,
  roomNameById,
  coachNameById,
  onPrev,
  onNext,
  totalFiltersActive,
  onClearFilters,
}) {
  const hasSessions = (sessions || []).length > 0;
  const safePage = Math.max(0, page | 0);
  const safeTotalPages = Math.max(0, totalPages | 0);
  const pageDisplay = safeTotalPages > 0 ? safePage + 1 : 0;

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
          totalFiltersActive
            ? 'Không có buổi tập phù hợp'
            : 'Chưa có buổi tập nào'
        }
        message={
          totalFiltersActive
            ? 'Thử bỏ bộ lọc hoặc đổi khoảng ngày.'
            : 'Hệ thống chưa ghi nhận buổi tập nào.'
        }
        action={
          totalFiltersActive ? (
            <Button variant="outline-danger" size="sm" onClick={onClearFilters}>
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
            <th>Huấn luyện viên</th>
            <th>Phòng tập</th>
            <th>Sức chứa</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {(sessions || []).map((s) => {
            const status = s?.status || '—';
            const className = s?.classId
              ? (classNameById.get(s.classId) || '—')
              : '—';
            const coachName = s?.coachId
              ? (coachNameById.get(s.coachId) || '—')
              : '—';
            const roomName = s?.roomId
              ? (roomNameById.get(s.roomId) || '—')
              : '—';
            return (
              <tr key={s.id}>
                <td>{formatGymDate(s.startTime)}</td>
                <td>
                  {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
                </td>
                <td>{className}</td>
                <td>{coachName}</td>
                <td>{roomName}</td>
                <td>{typeof s.capacity === 'number' ? s.capacity : '—'}</td>
                <td>
                  <span
                    className={`badge ${statusBadge[status] || 'bg-light text-dark'}`}
                  >
                    {statusLabel[status] || status}
                  </span>
                </td>
              </tr>
            );
          })}
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
            disabled={loading || safePage <= 0}
          >
            ‹ Trang trước
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onNext}
            disabled={
              loading ||
              safeTotalPages <= 0 ||
              safePage + 1 >= safeTotalPages
            }
          >
            Trang sau ›
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- Calendar subcomponent -----
const WEEKDAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

function CalendarView({
  loading,
  sessions,
  fetchedPages,
  totalPages,
  totalElements,
  weekRange,
  formatGymTime,
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

  const grouped = useMemo(() => groupByLocalDay(sessions || []), [sessions]);

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
  const todayYmd = useMemo(() => {
    const now = new Date();
    if (Number.isNaN(now.getTime())) return '';
    return now.toLocaleDateString('en-CA', {
      timeZone: GYM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, []);

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
            <Form.Control
              id="msl-cal-pick"
              type="date"
              size="sm"
              value={selectedYmd || ''}
              onChange={(e) => onSelectDate && onSelectDate(e.target.value)}
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
          <div className="msl-cal-table" role="rowgroup">
            <div className="msl-cal-head" role="row">
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
            <div className="msl-cal-body" role="rowgroup">
              {days.map((day) => {
                const daySessions = grouped.get(day.ymd) || [];
                const isToday = day.ymd === todayYmd;
                const isSelected = selectedYmd === day.ymd;
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
                    role="cell"
                  >
                    {daySessions.length === 0 ? (
                      <div className="msl-cal-empty">
                        Không có buổi tập
                      </div>
                    ) : (
                      daySessions.map((s) => {
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
                          <div
                            key={s.id}
                            className="msl-cal-session"
                            role="article"
                          >
                            <div className="msl-cal-session-time">
                              {formatGymTime(s.startTime)} –{' '}
                              {formatGymTime(s.endTime)}
                            </div>
                            <div className="msl-cal-session-class">
                              {className}
                            </div>
                            <div className="msl-cal-session-meta">
                              {coachName} · {roomName}
                            </div>
                            <div className="msl-cal-session-status">
                              <span
                                className={`badge ${statusBadge[status] || 'bg-light text-dark'}`}
                              >
                                {statusLabel[status] || status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!loading && (sessions || []).length === 0 ? (
        <EmptyState
          title="Không có buổi tập trong tuần này"
          message="Hãy thử tuần khác hoặc bỏ bộ lọc."
        />
      ) : null}
    </div>
  );
}
