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
//   - Required fields: classId, coachId, roomId, startDate,
//     weekdays, startTime, endTime, capacity and sessionCount.
//   - weekdays: ISO weekday numbers 1..7 (Mon=1, Sun=7), must be
//     unique and non-empty.
//   - startDate: yyyy-MM-dd, must be today or later (Asia/Ho_Chi_Minh).
//   - startTime / endTime: HH:mm, endTime must be strictly after
//     startTime and each Session must last from 30 to 90 minutes.
//   - capacity: positive integer; must not exceed selected Room's
//     capacity.
//   - Generates 1..100 ClassSession rows starting on/after
//     startDate, on the selected weekdays, in Asia/Ho_Chi_Minh.
//   - All-or-nothing: the entire batch is created or none is.
//     The FE computes the same occurrence windows only for coach
//     availability discovery. The BE remains authoritative and creates
//     the sessions transactionally from the recurring request.
//
// Room options come from US25. Coach options come from the availability
// discovery endpoint and must be free for every generated occurrence.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useForm, Controller } from 'react-hook-form';
import { RhfDateInput } from '../../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass } from '../../../services/sportClassService';
import { listRooms } from '../../../services/roomService';
import { discoverAvailableCoaches } from '../../../services/classSessionService';
import { createRecurringSchedule } from '../../../services/recurringScheduleService';
import {
  applyServerErrors,
  hasServerFieldMessage,
} from '../../../utils/serverErrors';
import {
  getGymZoneTodayIsoDate,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';

// Locale-agnostic yyyy-MM-dd used by the model/API.
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
function localTimeToMinutes(value) {
  const match = ISO_TIME_RE.exec(value);
  if (!match) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

const recurringScheduleCreateSchema = z
  .object({
    coachId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
    roomId: z.string().min(1, 'Vui lòng chọn phòng tập.'),
    startDate: z
      .string()
      .regex(ISO_DATE_RE, 'Ngày bắt đầu không hợp lệ (định dạng yyyy-MM-dd).')
      .refine(
        (d) => d >= getGymZoneTodayIsoDate(),
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
    sessionCount: z.coerce
      .number({ invalid_type_error: 'Số buổi phải là số nguyên.' })
      .int('Số buổi phải là số nguyên.')
      .min(1, 'Số buổi phải từ 1 trở lên.')
      .max(100, 'Số buổi không được vượt quá 100.'),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu.',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      const start = localTimeToMinutes(data.startTime);
      const end = localTimeToMinutes(data.endTime);
      return start == null || end == null || end - start >= 30;
    },
    {
      message: 'Thời lượng mỗi buổi tập phải ít nhất 30 phút.',
      path: ['endTime'],
    },
  )
  .refine(
    (data) => {
      const start = localTimeToMinutes(data.startTime);
      const end = localTimeToMinutes(data.endTime);
      return start == null || end == null || end - start <= 90;
    },
    {
      message: 'Thời lượng mỗi buổi tập không được vượt quá 90 phút.',
      path: ['endTime'],
    },
  );

function addGymLocalDays(date, days) {
  if (!ISO_DATE_RE.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day + days));
  return instant.toISOString().slice(0, 10);
}

function getIsoWeekday(date) {
  if (!ISO_DATE_RE.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

// Mirrors the backend's recurring occurrence generation so coach discovery
// checks every actual window that would be created by the submit request.
function buildRecurringWindows({
  startDate,
  weekdays,
  startTime,
  endTime,
  sessionCount,
}) {
  const count = Number(sessionCount);
  const selectedDays = new Set(
    Array.isArray(weekdays) ? weekdays.map(Number) : [],
  );
  if (
    !ISO_DATE_RE.test(startDate)
    || !ISO_TIME_RE.test(startTime)
    || !ISO_TIME_RE.test(endTime)
    || endTime <= startTime
    || !Number.isInteger(count)
    || count < 1
    || count > 100
    || selectedDays.size === 0
  ) {
    return [];
  }

  const windows = [];
  let offset = 0;
  while (windows.length < count && offset < 800) {
    const date = addGymLocalDays(startDate, offset);
    if (date && selectedDays.has(getIsoWeekday(date))) {
      const start = gymLocalDateToIsoInstant(date, startTime);
      const end = gymLocalDateToIsoInstant(date, endTime);
      if (!start || !end) return [];
      windows.push({ startTime: start, endTime: end });
    }
    offset += 1;
  }
  return windows.length === count ? windows : [];
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
  const [coachesLoading, setCoachesLoading] = useState(false);
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
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(recurringScheduleCreateSchema),
    defaultValues: {
      coachId: '',
      roomId: '',
      startDate: getGymZoneTodayIsoDate(),
      weekdays: [],
      startTime: '',
      endTime: '',
      capacity: '',
      sessionCount: 30,
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

  const availabilityStartDate = watch('startDate');
  const availabilityWeekdays = watch('weekdays');
  const availabilityWeekdayKey = Array.isArray(availabilityWeekdays)
    ? availabilityWeekdays.join(',')
    : '';
  const availabilityStartTime = watch('startTime');
  const availabilityEndTime = watch('endTime');
  const availabilitySessionCount = watch('sessionCount');
  const occurrenceWindows = useMemo(
    () => buildRecurringWindows({
      startDate: availabilityStartDate,
      weekdays: availabilityWeekdayKey
        ? availabilityWeekdayKey.split(',').map(Number)
        : [],
      startTime: availabilityStartTime,
      endTime: availabilityEndTime,
      sessionCount: availabilitySessionCount,
    }),
    [
      availabilityStartDate,
      availabilityWeekdayKey,
      availabilityStartTime,
      availabilityEndTime,
      availabilitySessionCount,
    ],
  );

  useEffect(() => {
    if (occurrenceWindows.length === 0) {
      setCoaches([]);
      setCoachesError(null);
      setCoachesLoading(false);
      if (getValues('coachId')) setValue('coachId', '');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCoachesLoading(true);
      setCoachesError(null);
      try {
        const result = await discoverAvailableCoaches({
          startTimes: occurrenceWindows.map((window) => window.startTime),
          endTimes: occurrenceWindows.map((window) => window.endTime),
        });
        if (cancelled) return;
        setCoaches(result);
        const selectedCoachId = getValues('coachId');
        if (
          selectedCoachId
          && !result.some((coach) => coach.coachAccountId === selectedCoachId)
        ) {
          setValue('coachId', '');
        }
      } catch (error) {
        if (!cancelled) {
          setCoaches([]);
          setCoachesError(error);
          if (getValues('coachId')) setValue('coachId', '');
        }
      } finally {
        if (!cancelled) setCoachesLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [occurrenceWindows, getValues, setValue]);

  const coachOptions = useMemo(() => {
    return coaches
      .map((acc) => ({
        value: acc.coachAccountId,
        label: acc.fullName || acc.phone || '—',
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
      startDate: getGymZoneTodayIsoDate(),
      weekdays: [],
      startTime: '',
      endTime: '',
      capacity: '',
      sessionCount: 30,
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
        sessionCount: data.sessionCount,
      });
      setSuccess({
        id: response?.id,
        sessionCount: response?.sessionCount,
        sessionIds: response?.sessionIds,
      });
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;
      const problem = err?.response?.data || {};

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
          'sessionCount',
        ],
      });

      // Page-local known-error mappings. Each one suppresses the
      // global ErrorAlert for the same error so the user does
      // not see the same message twice (the US25
      // `pageLocalHandled` pattern).
      let pageLocalHandled = false;
      switch (code) {
        case 'LEGACY_YOGA_UNSUPPORTED':
          setServerError({
            ...err,
            response: {
              ...err?.response,
              data: {
                ...(err?.response?.data || {}),
                message:
                  'Lớp Yoga cũ chỉ được giữ lại để xem lịch sử và không thể tạo thêm lịch cố định.',
              },
            },
          });
          pageLocalHandled = true;
          break;
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
          if (!hasServerFieldMessage(fieldErrors, 'coachId')) {
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
          if (!hasServerFieldMessage(fieldErrors, 'roomId')) {
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
        case 'ROOM_CAPACITY_BELOW_SESSION_CAPACITY':
          if (!hasServerFieldMessage(fieldErrors, 'capacity')) {
            setError('capacity', {
              type: 'server',
              message:
                'Sức chứa mỗi buổi tập không được vượt quá sức chứa của phòng.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'ROOM_TIME_CONFLICT':
          setError('roomId', { type: 'server', message: 'Phòng dùng riêng đã có buổi tập trùng giờ trong lịch lặp.' });
          pageLocalHandled = true;
          break;
        case 'SHARED_ROOM_CAPACITY_EXCEEDED':
          setError('roomId', {
            type: 'server',
            message: `Phòng dùng chung không đủ chỗ ở một khung giờ: đang dùng ${problem.occupiedCapacity ?? '—'}/${problem.roomCapacity ?? '—'}, cần thêm ${problem.requestedCapacity ?? '—'} chỗ.`,
          });
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
        Chọn số buổi cần tạo theo các ngày trong tuần và khung giờ đã chọn.
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
                  ? occurrenceWindows.length > 0
                    ? 'Không có huấn luyện viên phù hợp cho toàn bộ lịch'
                    : 'Hoàn tất lịch để tìm huấn luyện viên'
                  : '— Chọn huấn luyện viên —'}
            </option>
            {coachOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Chỉ hiển thị huấn luyện viên còn trống ở tất cả các buổi dự kiến.
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
                  ? 'Không có phòng tập đang hoạt động'
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
          <RhfDateInput
            control={control}
            name="startDate"
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

        <Form.Group className="mt-3" controlId="rsc-sessionCount">
          <Form.Label>Số buổi tập *</Form.Label>
          <Form.Control
            type="number"
            min={1}
            max={100}
            step={1}
            {...register('sessionCount')}
            isInvalid={Boolean(errors.sessionCount)}
            disabled={!classIsActive}
          />
          <Form.Text className="text-muted">
            Có thể tạo từ 1 đến 100 buổi. Giá trị mặc định là 30.
          </Form.Text>
          <Form.Control.Feedback type="invalid">
            {errors.sessionCount?.message}
          </Form.Control.Feedback>
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
            Hủy
          </Button>
        </div>
      </Form>
    </div>
  );
}
