// Manager – Recurring Schedule Creation (US26).
//
// Reached from a specific Class Detail page:
//   /manager/classes/:classId/recurring-schedules/new
//
// The Class is NOT selected again on this page. It is loaded
// read-only via the existing GET /api/v1/manager/classes/{classId}
// endpoint and used as context for the request.
//
// Backend behavior (RecurringScheduleService#create):
//   - 8 required fields: classId, coachId, roomId, startDate,
//     weekdays, startTime, endTime, capacity.
//   - weekdays: ISO weekday numbers 1..7 (Mon=1, Sun=7), must be
//     unique and non-empty.
//   - startDate: yyyy-MM-dd, must be today or later (Asia/Ho_Chi_Minh).
//   - startTime / endTime: HH:mm, endTime must be strictly after
//     startTime.
//   - capacity: positive integer; must not exceed selected Room's
//     capacity.
//   - Generates exactly 30 ClassSession rows starting on/after
//     startDate, on the selected weekdays, in Asia/Ho_Chi_Minh.
//   - All-or-nothing: the entire batch is created or none is.
//     The FE does NOT pre-compute occurrences; it sends one
//     request and renders the BE's success response.
//
// The supporting selects (Room / Coach) are loaded via the
// existing US25 / US05-08 services:
//   - listRooms()   (US25)
//   - searchStaffAccounts({ role: 'COACH', status: 'ACTIVE' })
//     — paginated to the BE-allowed max page size of 100, walked
//     until the BE reports no more pages, so every eligible
//     ACTIVE COACH is selectable.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass } from '../../../services/sportClassService';
import { listRooms } from '../../../services/roomService';
import { searchStaffAccounts } from '../../../services/staffAccountService';
import { createRecurringSchedule } from '../../../services/recurringScheduleService';
import { applyServerErrors } from '../../../utils/serverErrors';

// Maximum page size the BE accepts for /manager/staff-accounts
// (StaffAccountController validation: 1 <= size <= 100). Using the
// largest supported size keeps the number of round-trips bounded
// and guarantees every eligible ACTIVE COACH is reachable in
// practice. We still walk every page until totalPages is reached,
// so the result is independent of the page size.
const COACH_PAGE_SIZE = 100;

// Locale-agnostic yyyy-MM-dd (matches HTML <input type="date">).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_LABELS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 7, label: 'Chủ nhật' },
];

const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

// Page-local Zod schema for the editable fields only. `classId`
// is read from the route/loaded class and is not validated as a
// form field.
const recurringScheduleCreateSchema = z
  .object({
    coachId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
    roomId: z.string().min(1, 'Vui lòng chọn phòng tập.'),
    startDate: z
      .string()
      .regex(ISO_DATE_RE, 'Ngày bắt đầu không hợp lệ (định dạng yyyy-MM-dd).')
      .refine(
        (d) => d >= getLocalTodayIsoDate(),
        'Ngày bắt đầu phải từ hôm nay trở đi.',
      ),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'Vui lòng chọn ít nhất một ngày trong tuần.')
      .refine(
        (arr) => new Set(arr).size === arr.length,
        'Các ngày trong tuần không được trùng nhau.',
      ),
    startTime: z
      .string()
      .regex(ISO_TIME_RE, 'Giờ bắt đầu không hợp lệ (định dạng HH:mm).'),
    endTime: z
      .string()
      .regex(ISO_TIME_RE, 'Giờ kết thúc không hợp lệ (định dạng HH:mm).'),
    capacity: z.coerce
      .number({
        invalid_type_error: 'Sức chứa phải là số nguyên dương.',
      })
      .int('Sức chứa phải là số nguyên dương.')
      .positive('Sức chứa phải lớn hơn 0.'),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu.',
    path: ['endTime'],
  });

// Returns today's calendar date in the browser's local time zone
// formatted as yyyy-MM-dd. Matches the HTML date input's value
// format and the user's perspective of "today". The backend
// re-validates against Asia/Ho_Chi_Minh; any cross-time-zone
// edge case surfaces as an inline startDate error from the BE.
function getLocalTodayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hasFieldMessage(fieldErrors, field) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return false;
  const list = fieldErrors[field];
  if (Array.isArray(list)) {
    return list.some((m) => typeof m === 'string' && m.trim());
  }
  return typeof list === 'string' && list.trim().length > 0;
}

// Fetches every ACTIVE COACH account by walking the existing
// paged /manager/staff-accounts endpoint until the BE says there
// are no more pages. Uses the BE-allowed max page size of 100.
async function fetchAllActiveCoaches() {
  const aggregated = [];
  let page = 0;
  // Defensive upper bound: stop after 50 pages (5000 rows) to
  // avoid any runaway loop.
  const MAX_PAGES = 50;
  while (page < MAX_PAGES) {
    const result = await searchStaffAccounts({
      role: 'COACH',
      status: 'ACTIVE',
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

export default function RecurringScheduleCreatePage() {
  const { classId } = useParams();

  // Class context (read-only). Loaded via the existing
  // GET /manager/classes/{classId} endpoint. Not a form field.
  const [classData, setClassData] = useState(null);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError] = useState(null);

  // Supporting-data state. useState is appropriate here because
  // these are not form field values.
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState(null);

  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(recurringScheduleCreateSchema),
    defaultValues: {
      coachId: '',
      roomId: '',
      startDate: getLocalTodayIsoDate(),
      weekdays: [],
      startTime: '',
      endTime: '',
      capacity: '',
    },
  });

  // ---- Supporting data loaders ----

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    setClassLoading(true);
    setClassError(null);
    getClass(classId)
      .then((data) => {
        if (cancelled) return;
        setClassData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setClassError(err);
      })
      .finally(() => {
        if (!cancelled) setClassLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

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

  // ---- Derived lists for selectors ----

  const activeRooms = useMemo(
    () => rooms.filter((r) => r && r.status === 'ACTIVE'),
    [rooms],
  );

  const roomOptions = useMemo(() => {
    return activeRooms
      .map((r) => ({
        value: r.id,
        label: r.name || '—',
        capacity: r.capacity,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeRooms]);

  const coachOptions = useMemo(() => {
    return coaches
      .map((acc) => ({
        value: acc.accountId,
        label: acc.fullName || acc.email || '—',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [coaches]);

  const supportingDataError =
    roomsError || coachesError || null;
  const supportingDataLoading =
    roomsLoading || coachesLoading;
  const classIsActive = classData?.status === 'ACTIVE';
  const classCanSubmit =
    !!classData && classIsActive && !classError && !classLoading;
  const canSubmit =
    classCanSubmit &&
    !supportingDataLoading &&
    !supportingDataError &&
    activeRooms.length > 0 &&
    coachOptions.length > 0;

  // Selected room helper text.
  const selectedRoomId = watch('roomId');
  const selectedRoomCapacity = useMemo(() => {
    const found = activeRooms.find((r) => r.id === selectedRoomId);
    return found ? found.capacity : null;
  }, [activeRooms, selectedRoomId]);

  // ---- Submit / reset ----

  const handleResetForm = useCallback(() => {
    reset({
      coachId: '',
      roomId: '',
      startDate: getLocalTodayIsoDate(),
      weekdays: [],
      startTime: '',
      endTime: '',
      capacity: '',
    });
    setServerError(null);
    setSuccess(null);
  }, [reset]);

  async function onSubmit(data) {
    setServerError(null);
    setSuccess(null);
    try {
      const response = await createRecurringSchedule({
        classId,
        coachId: data.coachId,
        roomId: data.roomId,
        startDate: data.startDate,
        weekdays: data.weekdays,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
      });
      setSuccess({
        id: response?.id,
        sessionCount: response?.sessionCount,
        sessionIds: response?.sessionIds,
      });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;

      // Shared helper: per-field errors restricted to the
      // rendered editable fields. `classId` is NOT in the
      // allowlist because it is no longer a form field on this
      // page.
      const sharedHandled = applyServerErrors(err, setError, {
        fields: [
          'coachId',
          'roomId',
          'startDate',
          'weekdays',
          'startTime',
          'endTime',
          'capacity',
        ],
      });

      // Page-local known-error mappings. Each one suppresses the
      // global ErrorAlert for the same error so the user does
      // not see the same message twice (the US25
      // `pageLocalHandled` pattern).
      let pageLocalHandled = false;
      switch (code) {
        case 'CLASS_NOT_FOUND':
        case 'CLASS_INACTIVE':
          // The Class is context, not an editable field. Surface
          // this as a clear form/page-level message and disable
          // creation by NOT marking it as `pageLocalHandled` —
          // we still want the user to see the error.
          setServerError({
            ...err,
            response: {
              ...err?.response,
              data: {
                ...(err?.response?.data || {}),
                _pageLevelMessage:
                  code === 'CLASS_INACTIVE'
                    ? 'Lớp học đang ngưng hoạt động. Không thể tạo lịch cố định cho lớp này.'
                    : 'Lớp học không tồn tại hoặc đã bị xoá. Vui lòng quay lại trang chi tiết lớp.',
              },
            },
          });
          pageLocalHandled = true;
          break;
        case 'COACH_NOT_FOUND':
        case 'COACH_NOT_ACTIVE':
          if (!hasFieldMessage(fieldErrors, 'coachId')) {
            setError('coachId', {
              type: 'server',
              message:
                code === 'COACH_NOT_ACTIVE'
                  ? 'Tài khoản này không phải huấn luyện viên đang hoạt động.'
                  : 'Huấn luyện viên không tồn tại. Vui lòng chọn lại.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'ROOM_NOT_FOUND':
        case 'ROOM_INACTIVE':
          if (!hasFieldMessage(fieldErrors, 'roomId')) {
            setError('roomId', {
              type: 'server',
              message:
                code === 'ROOM_INACTIVE'
                  ? 'Phòng tập đang ngưng hoạt động. Vui lòng chọn phòng khác.'
                  : 'Phòng tập không tồn tại. Vui lòng chọn lại.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'SESSION_CAPACITY_EXCEEDS_ROOM':
          if (!hasFieldMessage(fieldErrors, 'capacity')) {
            setError('capacity', {
              type: 'server',
              message:
                'Sức chứa mỗi buổi tập không được vượt quá sức chứa của phòng.',
            });
          }
          pageLocalHandled = true;
          break;
        default:
          break;
      }

      // Global ErrorAlert is the fallback: only when neither the
      // shared helper nor a page-local mapping handled the
      // error. SESSION_CONFLICT and RECURRING_SCHEDULE_CONFLICT
      // intentionally fall through to here.
      if (!sharedHandled && !pageLocalHandled) {
        setServerError(err);
      }
    }
  }

  // ---- Class loading / missing / inactive states ----

  if (classLoading) {
    return (
      <div>
        <Link
          to={`/manager/classes/${classId}`}
          className="small text-decoration-none"
        >
          ← Quay lại chi tiết lớp
        </Link>
        <h1 className="h3 fw-bold mt-2 mb-4">Tạo lịch cố định</h1>
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      </div>
    );
  }

  if (classError || !classData) {
    return (
      <div>
        <Link
          to="/manager/classes"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <h1 className="h3 fw-bold mt-2 mb-4">Tạo lịch cố định</h1>
        <ErrorAlert
          className="mt-3"
          error={classError}
          title="Không tải được lớp học"
        />
      </div>
    );
  }

  // ---- Success state ----

  if (success) {
    return (
      <div>
        <h1 className="h3 fw-bold mb-3">Tạo lịch cố định</h1>
        <Alert variant="success" className="d-flex flex-column gap-2">
          <div className="fw-semibold">Đã tạo lịch cố định.</div>
          <div>
            Mã lịch: <code>{success.id}</code>
          </div>
          <div>Số buổi tập đã tạo: {success.sessionCount}</div>
        </Alert>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="danger" onClick={handleResetForm}>
            Tạo lịch cố định khác
          </Button>
          <Button
            as={Link}
            to={`/manager/classes/${classId}`}
            variant="outline-secondary"
          >
            Quay lại Lớp học
          </Button>
        </div>
      </div>
    );
  }

  // ---- Form ----

  const classTypeLabel =
    TYPE_LABEL[classData.classType] || classData.classType || '—';

  return (
    <div>
      <Link
        to={`/manager/classes/${classId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết lớp
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo lịch cố định</h1>
      <p className="text-muted mb-4">
        Hệ thống sẽ tạo 30 buổi tập theo các ngày trong tuần và khung
        giờ đã chọn, bắt đầu từ ngày được chọn.
      </p>

      {/* Class context (readonly) */}
      <div className="border rounded p-3 mb-4 bg-light">
        <div className="text-uppercase small text-muted">Lớp học</div>
        <div className="fw-semibold fs-5">
          {classData.name || '—'}{' '}
          <span className="text-muted small fw-normal">({classTypeLabel})</span>
        </div>
        {classData.disciplineName ? (
          <div className="text-muted small">
            Bộ môn: {classData.disciplineName}
          </div>
        ) : null}
        {classData.status === 'INACTIVE' ? (
          <Alert variant="warning" className="mt-2 mb-0">
            Lớp học đang ngưng hoạt động. Không thể tạo lịch cố định
            cho lớp này. Vui lòng kích hoạt lại lớp trước khi tạo lịch.
          </Alert>
        ) : null}
      </div>

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
        title="Không tạo được lịch cố định"
        onClose={serverError ? () => setServerError(null) : undefined}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="rsc-coachId">
          <Form.Label>Huấn luyện viên *</Form.Label>
          <Form.Select
            {...register('coachId')}
            isInvalid={Boolean(errors.coachId)}
            disabled={coachesLoading || !classIsActive}
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
            Chỉ các tài khoản COACH đang ACTIVE mới được chọn.
          </Form.Text>
          <Form.Control.Feedback type="invalid">
            {errors.coachId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="rsc-roomId">
          <Form.Label>Phòng tập *</Form.Label>
          <Form.Select
            {...register('roomId')}
            isInvalid={Boolean(errors.roomId)}
            disabled={roomsLoading || !classIsActive}
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
          {selectedRoomCapacity != null ? (
            <Form.Text className="text-muted">
              Sức chứa phòng: {selectedRoomCapacity}. Vui lòng đặt sức
              chứa mỗi buổi tập không vượt quá con số này.
            </Form.Text>
          ) : null}
          <Form.Control.Feedback type="invalid">
            {errors.roomId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="rsc-startDate">
          <Form.Label>Ngày bắt đầu *</Form.Label>
          <Form.Control
            type="date"
            {...register('startDate')}
            isInvalid={Boolean(errors.startDate)}
            disabled={!classIsActive}
          />
          <Form.Control.Feedback type="invalid">
            {errors.startDate?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="rsc-weekdays">
          <Form.Label>Các ngày trong tuần *</Form.Label>
          <Controller
            name="weekdays"
            control={control}
            render={({ field, fieldState }) => {
              const value = Array.isArray(field.value) ? field.value : [];
              function toggle(day) {
                const next = value.includes(day)
                  ? value.filter((d) => d !== day)
                  : [...value, day].sort((a, b) => a - b);
                field.onChange(next);
              }
              return (
                <div>
                  <div className="d-flex flex-wrap gap-2">
                    {WEEKDAY_LABELS.map((d) => {
                      const checked = value.includes(d.value);
                      return (
                        <Form.Check
                          key={d.value}
                          id={`rsc-weekday-${d.value}`}
                          label={d.label}
                          checked={checked}
                          onChange={() => toggle(d.value)}
                          disabled={!classIsActive}
                        />
                      );
                    })}
                  </div>
                  {fieldState.error ? (
                    <div className="invalid-feedback d-block">
                      {fieldState.error.message}
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </Form.Group>

        <div className="row mt-3 g-3">
          <Form.Group className="col-sm-6" controlId="rsc-startTime">
            <Form.Label>Giờ bắt đầu *</Form.Label>
            <Form.Control
              type="time"
              {...register('startTime')}
              isInvalid={Boolean(errors.startTime)}
              disabled={!classIsActive}
            />
            <Form.Control.Feedback type="invalid">
              {errors.startTime?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="col-sm-6" controlId="rsc-endTime">
            <Form.Label>Giờ kết thúc *</Form.Label>
            <Form.Control
              type="time"
              {...register('endTime')}
              isInvalid={Boolean(errors.endTime)}
              disabled={!classIsActive}
            />
            <Form.Control.Feedback type="invalid">
              {errors.endTime?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </div>

        <Form.Group className="mt-3" controlId="rsc-capacity">
          <Form.Label>Sức chứa mỗi buổi tập *</Form.Label>
          <Form.Control
            type="number"
            min={1}
            step={1}
            {...register('capacity')}
            isInvalid={Boolean(errors.capacity)}
            placeholder="VD: 20"
            disabled={!classIsActive}
          />
          <Form.Text className="text-muted">
            Sức chứa phải lớn hơn 0 và không vượt quá sức chứa của
            phòng đã chọn. Hệ thống sẽ kiểm tra lại khi tạo lịch.
          </Form.Text>
          <Form.Control.Feedback type="invalid">
            {errors.capacity?.message}
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
                Đang tạo…
              </>
            ) : (
              'Tạo lịch cố định'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={handleResetForm}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
