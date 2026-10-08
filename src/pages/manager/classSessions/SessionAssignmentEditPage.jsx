// Manager – Update Session Coach / Room (US30).
//
// Reached from a specific Session Detail page:
//   /manager/class-sessions/:sessionId/assignment/edit
//
// The Session is loaded via the existing
//   GET /api/v1/manager/class-sessions/{id}
// endpoint and is used as the read-only context for the PATCH. The
// Session date / time / capacity / classId are NOT editable in US30;
// only `coachId` and `roomId` are mutable (BR-CLS-03, BR-SES-06,
// BR-SES-07).
//
// Backend behavior (ClassSessionService#updateAssignment, verified):
//   - PATCH body shape: { coachId?, roomId? } — partial update,
//     omitting a key keeps the current value. At least one key MUST
//     be present (else 400 VALIDATION_ERROR on field `request`).
//   - Session must exist (else 404 SESSION_NOT_FOUND).
//   - Session must be SCHEDULED (else 409 SESSION_NOT_SCHEDULED).
//   - Coach (when supplied) must exist + role=COACH + status=ACTIVE
//     (else 404 COACH_NOT_FOUND or 409 COACH_NOT_ACTIVE).
//   - Room (when supplied) must exist + status=ACTIVE (else
//     404 ROOM_NOT_FOUND or 409 ROOM_INACTIVE).
//   - Selected Room capacity must be >= session.capacity (else
//     409 SESSION_CAPACITY_EXCEEDS_ROOM — field hint `capacity`).
//   - Coach and Room are each checked for overlap against every other
//     Session with status in {SCHEDULED, IN_PROGRESS}, excluding the
//     current session. Any overlap → 409 SESSION_CONFLICT.
//   - Returns the updated ClassSessionDetailResponse (200 OK).
//   - Existing Bookings are NOT mutated (BR-SES-07) — the Session
//     date/time do not change.
//
// The FE does NOT replicate any of the BE checks. It maps the wire
// errors to friendly inline or form-level / global signals per the
// approved US30 error-mapping table.
//
// The supporting selects (Coach / Room) are loaded via the existing
// US25 / US05-08 services:
//   - listRooms()                                            (US25)
//   - searchStaffAccounts({ role: 'COACH', status: 'ACTIVE' })
//     — paginated to the BE-allowed max page size of 100, walked
//     until the BE reports no more pages. There is NO arbitrary
//     MAX_PAGES cap. The walk terminates only when:
//       * aggregated.length >= totalElements, OR
//       * the next page is empty, OR
//       * every totalPages page has been fetched.
//     Every eligible ACTIVE COACH is therefore reachable in practice.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getManagerSessionDetail, updateSessionAssignment } from '../../../services/classSessionService';
import { listRooms } from '../../../services/roomService';
import { searchStaffAccounts } from '../../../services/staffAccountService';
import { applyServerErrors } from '../../../utils/serverErrors';

// Maximum page size the BE accepts for /manager/staff-accounts
// (StaffAccountController validation: 1 <= size <= 100). The walk
// uses this size for every page request; it is independent of how
// many total pages exist.
const COACH_PAGE_SIZE = 100;

const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// ----- Time-zone helpers (page-local; matches US28 / US29) -----

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

// ----- Coach complete-pagination loader (no MAX_PAGES) -----

async function fetchAllActiveCoaches() {
  const aggregated = [];
  let page = 0;
  while (true) {
    const result = await searchStaffAccounts({
      role: 'COACH',
      status: 'ACTIVE',
      page,
      size: COACH_PAGE_SIZE,
    });
    const content = Array.isArray(result?.content) ? result.content : [];
    aggregated.push(...content);
    const totalElements = Number(result?.totalElements) || aggregated.length;
    const totalPages = Number(result?.totalPages) || 0;
    if (aggregated.length >= totalElements) break;
    if (content.length === 0) break;
    if (totalPages > 0 && page + 1 >= totalPages) break;
    page += 1;
  }
  return aggregated;
}

// ----- Return-state helpers (preserve US29 originating URL) -----

// Internal-only safe-from check: only strings beginning with
// /manager/class-sessions are forwarded into navigate state so we
// can never navigate to an arbitrary URL on save.
function readSafeFrom(state) {
  const from = state && typeof state.from === 'string' ? state.from : null;
  if (from && from.startsWith('/manager/class-sessions')) return from;
  return null;
}

// ----- Detail-to-form derivation -----

function detailToForm(detail) {
  return {
    coachId: detail?.coachId || '',
    roomId: detail?.roomId || '',
  };
}

// ----- Page-local Zod schema -----
//
// coachId / roomId are required at the form level so the user
// always makes an explicit selection. The PATCH diff is built
// against `original` (loaded from the Session Detail) so an
// unchanged value never produces a wire key (BE supports
// partial PATCH; omit unchanged).
const assignmentEditSchema = z.object({
  coachId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
  roomId: z.string().min(1, 'Vui lòng chọn phòng tập.'),
});

export default function SessionAssignmentEditPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Preserve the originating US28 List / Calendar URL across the
  // Detail → Edit → Detail navigation. `safeFrom` is only ever a
  // path beginning with /manager/class-sessions (defensive — we
  // never forward arbitrary URLs).
  const safeFrom = useMemo(
    () => readSafeFrom(location.state),
    [location.state],
  );
  const detailTarget = `/manager/class-sessions/${sessionId}`;

  // ----- Session detail (read-only context) -----
  const [sessionDetail, setSessionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState(null);

  const [original, setOriginal] = useState(null);

  // ----- Supporting selectors -----
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState(null);

  // ----- Form / submit state -----
  const [serverError, setServerError] = useState(null);
  const [formLevelConflict, setFormLevelConflict] = useState(null);
  const [noChanges, setNoChanges] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assignmentEditSchema),
    defaultValues: { coachId: '', roomId: '' },
  });

  // ----- Detail loader -----
  const loadDetail = useCallback(async () => {
    if (!sessionId) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const data = await getManagerSessionDetail(sessionId);
      setSessionDetail(data);
      const next = detailToForm(data);
      setOriginal(next);
      reset(next);
      setNoChanges(false);
    } catch (err) {
      setSessionDetail(null);
      setOriginal(null);
      setDetailError(err);
    } finally {
      setLoadingDetail(false);
    }
  }, [sessionId, reset]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // ----- Rooms loader -----
  useEffect(() => {
    let cancelled = false;
    setRoomsLoading(true);
    setRoomsError(null);
    listRooms()
      .then((result) => {
        if (cancelled) return;
        setRooms(Array.isArray(result) ? result : []);
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

  // ----- ACTIVE Coaches loader (complete pagination) -----
  useEffect(() => {
    let cancelled = false;
    setCoachesLoading(true);
    setCoachesError(null);
    fetchAllActiveCoaches()
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

  // ----- Derived option lists -----

  const activeRooms = useMemo(
    () => rooms.filter((r) => r && r.status === 'ACTIVE'),
    [rooms],
  );

  const roomOptions = useMemo(() => {
    return activeRooms
      .map((r) => ({
        value: r.id,
        label: r.name || '—',
        capacity: typeof r.capacity === 'number' ? r.capacity : null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeRooms]);

  // If the currently-assigned Coach is missing from the ACTIVE
  // walk results (e.g. deactivated between detail load and this
  // load), preserve it as a synthetic current option so we never
  // silently lose the existing assignment.
  const coachOptions = useMemo(() => {
    const base = coaches.map((acc) => ({
      value: acc.accountId,
      label: acc.fullName || acc.email || '—',
      inactive: false,
    }));
    const currentCoachId = sessionDetail?.coachId;
    if (
      currentCoachId &&
      !base.some((o) => o.value === currentCoachId)
    ) {
      base.unshift({
        value: currentCoachId,
        label: sessionDetail?.coachName
          ? `${sessionDetail.coachName} (không còn ACTIVE)`
          : '(không còn ACTIVE)',
        inactive: true,
      });
    }
    return base.sort((a, b) => a.label.localeCompare(b.label));
  }, [coaches, sessionDetail]);

  const supportingDataError = roomsError || coachesError || null;
  const supportingDataLoading = roomsLoading || coachesLoading;
  const supportingDataReady =
    !supportingDataLoading && !supportingDataError;

  // The page is editable only when the Session is SCHEDULED and
  // the BE says so via canUpdateAssignment. The check is duplicated
  // at submit time as defense-in-depth.
  const status = sessionDetail?.status || '';
  const isEditableSession =
    status === 'SCHEDULED' && sessionDetail?.canUpdateAssignment !== false;

  const detailLoaded = !loadingDetail && !!sessionDetail && !detailError;

  const canSubmit =
    detailLoaded &&
    isEditableSession &&
    supportingDataReady &&
    activeRooms.length > 0 &&
    coachOptions.length > 0;

  // ----- Build PATCH by diff vs. original -----

  function buildAssignmentPatch(data) {
    const patch = {};
    if (data.coachId !== (original?.coachId || '')) {
      patch.coachId = data.coachId;
    }
    if (data.roomId !== (original?.roomId || '')) {
      patch.roomId = data.roomId;
    }
    return patch;
  }

  function navigateBackToDetail(extras) {
    const baseState = safeFrom ? { from: safeFrom } : undefined;
    const nextState =
      baseState || extras
        ? { ...(baseState || {}), ...(extras || {}) }
        : undefined;
    navigate(detailTarget, {
      replace: true,
      state: nextState,
    });
  }

  // ----- Submit -----

  async function onSubmit(data) {
    setServerError(null);
    setFormLevelConflict(null);
    setNoChanges(false);

    if (!isEditableSession) {
      setServerError({
        message:
          'Buổi tập này không ở trạng thái Đã lên lịch nên không thể cập nhật.',
      });
      return;
    }

    const patch = buildAssignmentPatch(data);
    if (Object.keys(patch).length === 0) {
      setNoChanges(true);
      return;
    }

    try {
      await updateSessionAssignment(sessionId, patch);
      navigateBackToDetail({ assignmentUpdated: true });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;

      // Per-field errors restricted to the rendered editable fields.
      // capacity is intentionally NOT in the allowlist (capacity is
      // not editable on US30).
      const sharedHandled = applyServerErrors(err, setError, {
        fields: ['coachId', 'roomId'],
      });

      let pageLocalHandled = false;
      switch (code) {
        case 'COACH_NOT_FOUND':
          if (!fieldErrors?.coachId) {
            setError('coachId', {
              type: 'server',
              message: 'Huấn luyện viên không tồn tại. Vui lòng chọn lại.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'COACH_NOT_ACTIVE':
          // Single BE code covers both "not a COACH" and "INACTIVE"
          // (verified at ClassSessionService line 195).
          if (!fieldErrors?.coachId) {
            setError('coachId', {
              type: 'server',
              message:
                'Huấn luyện viên không hợp lệ hoặc đang ngưng hoạt động.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'ROOM_NOT_FOUND':
          if (!fieldErrors?.roomId) {
            setError('roomId', {
              type: 'server',
              message: 'Phòng tập không tồn tại. Vui lòng chọn lại.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'ROOM_INACTIVE':
          if (!fieldErrors?.roomId) {
            setError('roomId', {
              type: 'server',
              message:
                'Phòng tập đang ngưng hoạt động. Vui lòng chọn phòng khác.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'SESSION_CAPACITY_EXCEEDS_ROOM':
          // BE-supplied field hint is `capacity`, but capacity is
          // NOT a rendered form field on US30. Map to roomId so the
          // manager picks another Room.
          if (!fieldErrors?.roomId) {
            setError('roomId', {
              type: 'server',
              message:
                'Sức chứa của phòng này nhỏ hơn sức chứa buổi tập. Vui lòng chọn phòng khác.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'SESSION_CONFLICT':
          // Generic conflict — BE does NOT distinguish Coach vs
          // Room (verified). Form-level only; do NOT set global
          // ErrorAlert.
          setFormLevelConflict(
            'Huấn luyện viên hoặc phòng tập đã có buổi tập khác trùng giờ. Vui lòng chọn lại.',
          );
          pageLocalHandled = true;
          break;
        case 'SESSION_NOT_FOUND':
          // GLOBAL ONLY. Do NOT map inline. The invalid resource is
          // the Session itself, not an editable assignment field.
          setServerError(err);
          return;
        case 'SESSION_NOT_SCHEDULED':
          setServerError({
            ...err,
            response: {
              ...err?.response,
              data: {
                ...(err?.response?.data || {}),
                _pageLevelMessage:
                  'Buổi tập này không ở trạng thái Đã lên lịch nên không thể cập nhật.',
              },
            },
          });
          pageLocalHandled = true;
          break;
        case 'VALIDATION_ERROR':
          // The "coachId or roomId is required" case is unreachable
          // because the no-change guard prevents an empty PATCH from
          // ever being sent. Generic VALIDATION_ERROR with per-field
          // errors is already covered by applyServerErrors above; the
          // switch falls through to the global fallback below.
          break;
        case 'MALFORMED_REQUEST':
          setServerError(err);
          return;
        default:
          break;
      }

      if (!sharedHandled && !pageLocalHandled) {
        setServerError(err);
      }
    }
  }

  // ----- Render: detail-loading / detail-error states -----

  if (loadingDetail) {
    return (
      <div>
        <Link to={detailTarget} className="small text-decoration-none">
          ← Quay lại buổi tập
        </Link>
        <h1 className="h3 fw-bold mt-2 mb-4">Cập nhật HLV / Phòng</h1>
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      </div>
    );
  }

  if (detailError || !sessionDetail) {
    return (
      <div>
        <Link to={detailTarget} className="small text-decoration-none">
          ← Quay lại buổi tập
        </Link>
        <h1 className="h3 fw-bold mt-2 mb-4">Cập nhật HLV / Phòng</h1>
        <ErrorAlert
          className="mt-3"
          error={detailError}
          title="Không tải được buổi tập"
        />
      </div>
    );
  }

  // ----- Render: read-only context block -----

  const sessionCapacity =
    typeof sessionDetail.capacity === 'number' ? sessionDetail.capacity : null;

  return (
    <div>
      <Link to={detailTarget} className="small text-decoration-none">
        ← Quay lại buổi tập
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Cập nhật HLV / Phòng</h1>
      <p className="text-muted mb-4">
        Cập nhật huấn luyện viên hoặc phòng tập cho buổi tập{' '}
        <code className="small">{sessionId}</code>.
      </p>

      {/* ----- Read-only session context ----- */}
      <div className="border rounded p-3 mb-4 bg-light">
        <Row className="g-3">
          <Col md={6}>
            <div className="text-uppercase small text-muted">Lớp học</div>
            <div className="fw-semibold">{sessionDetail.className || '—'}</div>
          </Col>
          <Col md={6}>
            <div className="text-uppercase small text-muted">Ngày</div>
            <div className="fw-semibold">{formatGymDate(sessionDetail.startTime)}</div>
          </Col>
          <Col md={6}>
            <div className="text-uppercase small text-muted">Giờ</div>
            <div className="fw-semibold">
              {formatGymTime(sessionDetail.startTime)} –{' '}
              {formatGymTime(sessionDetail.endTime)}
            </div>
          </Col>
          <Col md={6}>
            <div className="text-uppercase small text-muted">Sức chứa buổi tập</div>
            <div className="fw-semibold">
              {sessionCapacity != null ? sessionCapacity : '—'}
            </div>
          </Col>
          <Col md={6}>
            <div className="text-uppercase small text-muted">
              Huấn luyện viên hiện tại
            </div>
            <div className="fw-semibold">{sessionDetail.coachName || '—'}</div>
          </Col>
          <Col md={6}>
            <div className="text-uppercase small text-muted">Phòng tập hiện tại</div>
            <div className="fw-semibold">
              {sessionDetail.roomName || '—'}
              {typeof sessionDetail.roomCapacity === 'number'
                ? ` (Sức chứa: ${sessionDetail.roomCapacity})`
                : ''}
            </div>
          </Col>
        </Row>
        <Form.Text className="text-muted d-block mt-2">
          Ngày, giờ, sức chứa và lớp học không thể thay đổi tại đây.
          Các buổi tập đã đặt trước sẽ được giữ nguyên.
        </Form.Text>
      </div>

      {!isEditableSession ? (
        <Alert variant="warning" className="mb-3">
          Buổi tập này không ở trạng thái Đã lên lịch nên không thể cập
          nhật huấn luyện viên hoặc phòng tập.
        </Alert>
      ) : null}

      {supportingDataError ? (
        <ErrorAlert
          className="mb-3"
          error={roomsError || coachesError}
          title={
            roomsError
              ? 'Không tải được danh sách phòng tập'
              : 'Không tải được danh sách huấn luyện viên'
          }
        />
      ) : null}

      <ErrorAlert
        error={serverError}
        title="Không cập nhật được buổi tập"
        onClose={serverError ? () => setServerError(null) : undefined}
      />

      {formLevelConflict ? (
        <div className="alert alert-warning py-2 mb-3">{formLevelConflict}</div>
      ) : null}
      {noChanges ? (
        <div className="alert alert-warning py-2 mb-3">
          Không có thay đổi để lưu.
        </div>
      ) : null}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="sse-coachId">
          <Form.Label>Huấn luyện viên *</Form.Label>
          <Form.Select
            {...register('coachId')}
            isInvalid={Boolean(errors.coachId)}
            disabled={!isEditableSession || coachesLoading}
          >
            <option value="">
              {coachesLoading
                ? 'Đang tải…'
                : coachOptions.length === 0
                  ? 'Không có huấn luyện viên ACTIVE'
                  : '— Chọn huấn luyện viên —'}
            </option>
            {coachOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Chỉ các tài khoản COACH đang ACTIVE mới được chọn. Nếu huấn
            luyện viên hiện tại đã ngưng hoạt động, hệ thống sẽ hiển thị
            tên kèm nhãn “(không còn ACTIVE)”.
          </Form.Text>
          <Form.Control.Feedback type="invalid">
            {errors.coachId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="sse-roomId">
          <Form.Label>Phòng tập *</Form.Label>
          <Form.Select
            {...register('roomId')}
            isInvalid={Boolean(errors.roomId)}
            disabled={!isEditableSession || roomsLoading}
          >
            <option value="">
              {roomsLoading
                ? 'Đang tải…'
                : roomOptions.length === 0
                  ? 'Không có phòng tập ACTIVE'
                  : '— Chọn phòng tập —'}
            </option>
            {roomOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.capacity != null ? ` (Sức chứa: ${o.capacity})` : ''}
              </option>
            ))}
          </Form.Select>
          {sessionCapacity != null ? (
            <Form.Text className="text-muted">
              Sức chứa buổi tập hiện tại là {sessionCapacity}. Phòng tập
              phải có sức chứa lớn hơn hoặc bằng con số này.
            </Form.Text>
          ) : null}
          <Form.Control.Feedback type="invalid">
            {errors.roomId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="mt-4 d-flex gap-2 flex-wrap">
          <Button
            type="submit"
            variant="danger"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang lưu…
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={navigateBackToDetail}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}