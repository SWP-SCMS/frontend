// Manager – Single Class Session Creation (US27).
//
// Reached from a specific Class Detail page:
//   /manager/classes/:classId/sessions/new
//
// The Class is NOT selected again on this page. It is loaded
// read-only via the existing GET /api/v1/manager/classes/{classId}
// endpoint and used as context for the request.
//
// Backend behavior (ClassSessionService#create):
//   - 6 required fields: classId, coachId, roomId, startTime,
//     endTime, capacity.
//   - startTime / endTime: ISO-8601 Instant values representing the
//     selected Asia/Ho_Chi_Minh wall-clock. The FE converts the
//     manager's date + HH:mm selection to those Instants (see
//     gymLocalDateToIsoInstant utility below). The BE then compares
//     startTime strictly against clock.instant() (must be in the
//     future), endTime strictly against startTime, and duration at most
//     from 30 to 90 minutes.
//   - capacity: positive integer; must not exceed the selected
//     Room's capacity (BE-side check).
//   - Backend validates Class / Coach / Room existence and status,
//     Coach/Room overlap, capacity-vs-room, and concurrency. The FE
//     does NOT replicate any of these — they are BE-authoritative.
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
import { useForm } from 'react-hook-form';
import { RhfDateInput } from '../../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass } from '../../../services/sportClassService';
import { discoverRoomAvailability, listRooms } from '../../../services/roomService';
import {
  createSingleSession,
  discoverAvailableCoaches,
} from '../../../services/classSessionService';
import {
  applyServerErrors,
  hasServerFieldMessage,
} from '../../../utils/serverErrors';
import {
  formatGymDate,
  formatGymTime,
  getGymZoneTodayIsoDate,
  gymLocalDateToIsoInstant,
  ISO_DATE_RE,
} from '../../../utils/gymTime';

// Locale-agnostic yyyy-MM-dd used by the model/API.
const ISO_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

// Page-local Zod schema for the editable fields only. `classId` is
// read from the route/loaded class and is not validated as a form
// field.
function localTimeToMinutes(value) {
  const match = ISO_TIME_RE.exec(value);
  if (!match) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

const singleSessionCreateSchema = z
  .object({
    coachId: z.string().min(1, 'Vui lòng chọn huấn luyện viên.'),
    roomId: z.string().min(1, 'Vui lòng chọn phòng tập.'),
    sessionDate: z
      .string()
      .regex(ISO_DATE_RE, 'Ngày buổi tập không hợp lệ (định dạng yyyy-MM-dd).')
      .refine(
        (d) => d >= getGymZoneTodayIsoDate(),
        'Ngày buổi tập phải từ hôm nay trở đi.',
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
  })
  .refine(
    (data) => {
      const start = localTimeToMinutes(data.startTime);
      const end = localTimeToMinutes(data.endTime);
      return start == null || end == null || end - start >= 30;
    },
    {
      message: 'Thời lượng buổi tập phải ít nhất 30 phút.',
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
      message: 'Thời lượng buổi tập không được vượt quá 90 phút.',
      path: ['endTime'],
    },
  );

export default function SingleSessionCreatePage() {
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
  const [roomAvailability, setRoomAvailability] = useState(null);
  const [roomAvailabilityLoading, setRoomAvailabilityLoading] = useState(false);
  const [roomAvailabilityError, setRoomAvailabilityError] = useState(null);

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
    resolver: zodResolver(singleSessionCreateSchema),
    defaultValues: {
      coachId: '',
      roomId: '',
      sessionDate: getGymZoneTodayIsoDate(),
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

  // ---- Derived lists for selectors ----

  const activeRooms = useMemo(
    () => rooms.filter((r) => r && r.status === 'ACTIVE'),
    [rooms],
  );

  const availabilityDate = watch('sessionDate');
  const availabilityStart = watch('startTime');
  const availabilityEnd = watch('endTime');
  const availabilityCapacity = watch('capacity');
  useEffect(() => {
    const startTime = gymLocalDateToIsoInstant(availabilityDate, availabilityStart);
    const endTime = gymLocalDateToIsoInstant(availabilityDate, availabilityEnd);
    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
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
          startTimes: [startTime],
          endTimes: [endTime],
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
  }, [availabilityDate, availabilityStart, availabilityEnd, getValues, setValue]);

  useEffect(() => {
    const startTime = gymLocalDateToIsoInstant(availabilityDate, availabilityStart);
    const endTime = gymLocalDateToIsoInstant(availabilityDate, availabilityEnd);
    const requestedCapacity = Number(availabilityCapacity);
    if (
      !startTime
      || !endTime
      || new Date(endTime) <= new Date(startTime)
      || !Number.isInteger(requestedCapacity)
      || requestedCapacity < 1
    ) {
      setRoomAvailability(null);
      setRoomAvailabilityError(null);
      setRoomAvailabilityLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setRoomAvailabilityLoading(true);
      setRoomAvailabilityError(null);
      try {
        const result = await discoverRoomAvailability({ startTime, endTime, requestedCapacity });
        if (!cancelled) setRoomAvailability(result);
      } catch (error) {
        if (!cancelled) {
          setRoomAvailability(null);
          setRoomAvailabilityError(error);
        }
      } finally {
        if (!cancelled) setRoomAvailabilityLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [availabilityDate, availabilityStart, availabilityEnd, availabilityCapacity]);

  const roomOptions = useMemo(() => {
    const source = roomAvailability || activeRooms;
    return source
      .map((r) => ({
        value: r.roomId || r.id,
        label: r.name || '—',
        capacity: r.capacity,
        availableCapacity: r.availableCapacity,
        available: r.available !== false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeRooms, roomAvailability]);

  const coachOptions = useMemo(() => {
    return coaches
      .map((acc) => ({
        value: acc.coachAccountId,
        label: acc.fullName || acc.phone || '—',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [coaches]);

  const supportingDataError = roomsError || coachesError || null;
  const supportingDataLoading = roomsLoading || coachesLoading;
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
    const found = roomOptions.find((r) => r.value === selectedRoomId);
    return found ? found.capacity : null;
  }, [roomOptions, selectedRoomId]);

  // ---- Submit / reset ----

  const handleResetForm = useCallback(() => {
    reset({
      coachId: '',
      roomId: '',
      sessionDate: getGymZoneTodayIsoDate(),
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

    const startIso = gymLocalDateToIsoInstant(data.sessionDate, data.startTime);
    const endIso = gymLocalDateToIsoInstant(data.sessionDate, data.endTime);
    if (!startIso || !endIso) {
      // Defensive: the Zod schema already enforces valid yyyy-MM-dd
      // and HH:mm, so this should not be reachable in practice.
      setServerError({
        message: 'Ngày hoặc giờ không hợp lệ. Vui lòng kiểm tra lại.',
      });
      return;
    }

    try {
      const response = await createSingleSession({
        classId,
        coachId: data.coachId,
        roomId: data.roomId,
        startTime: startIso,
        endTime: endIso,
        capacity: data.capacity,
      });
      setSuccess(response || null);
    } catch (err) {
      const fieldErrors = err?.response?.data?.errors;
      const code = err?.response?.data?.code;
      const problem = err?.response?.data || {};

      // Shared helper: per-field errors restricted to the rendered
      // editable fields. `classId` is NOT in the allowlist because
      // it is not an editable field on this page.
      const sharedHandled = applyServerErrors(err, setError, {
        fields: [
          'coachId',
          'roomId',
          'startTime',
          'endTime',
          'capacity',
        ],
      });

      // Page-local known-error mappings. Each one suppresses the
      // global ErrorAlert for the same error so the user does not
      // see the same message twice (the US25 / US26
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
                  'Lớp Yoga cũ chỉ được giữ lại để xem lịch sử và không thể tạo thêm buổi tập mới.',
              },
            },
          });
          pageLocalHandled = true;
          break;
        case 'CLASS_NOT_FOUND':
        case 'CLASS_INACTIVE':
          // The Class is context, not an editable field. Surface
          // this as a clear page-level business error. We do NOT
          // attempt to set an inline classId error because
          // classId is not editable on this page.
          setServerError({
            ...err,
            response: {
              ...err?.response,
              data: {
                ...(err?.response?.data || {}),
                _pageLevelMessage:
                  code === 'CLASS_INACTIVE'
                    ? 'Lớp học đang ngưng hoạt động. Không thể tạo buổi tập cho lớp này.'
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
                'Sức chứa không được vượt quá sức chứa của phòng đã chọn.',
            });
          }
          pageLocalHandled = true;
          break;
        case 'ROOM_TIME_CONFLICT':
          setError('roomId', { type: 'server', message: 'Phòng dùng riêng đã có buổi tập trùng giờ. Vui lòng chọn phòng hoặc thời gian khác.' });
          pageLocalHandled = true;
          break;
        case 'SHARED_ROOM_CAPACITY_EXCEEDED':
          setError('roomId', {
            type: 'server',
            message: `Phòng dùng chung không còn đủ chỗ: đang dùng ${problem.occupiedCapacity ?? '—'}/${problem.roomCapacity ?? '—'}, buổi tập cần thêm ${problem.requestedCapacity ?? '—'} chỗ.`,
          });
          pageLocalHandled = true;
          break;
        default:
          break;
      }

      // Global ErrorAlert is the fallback: only when neither the
      // shared helper nor a page-local mapping handled the
      // error. SESSION_CONFLICT intentionally falls through to
      // here (the BE does not name the conflicting Coach or
      // Room, so we do not mark either field inline).
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
        <h1 className="h3 fw-bold mt-2 mb-4">Tạo buổi tập</h1>
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
        <h1 className="h3 fw-bold mt-2 mb-4">Tạo buổi tập</h1>
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
    const successDate = formatGymDate(success.startTime);
    const successStart = formatGymTime(success.startTime);
    const successEnd = formatGymTime(success.endTime);
    return (
      <div>
        <h1 className="h3 fw-bold mb-3">Tạo buổi tập</h1>
        <Alert variant="success" className="d-flex flex-column gap-2">
          <div className="fw-semibold">Đã tạo buổi tập.</div>
          <div>
            Mã buổi tập: <code>{success.id}</code>
          </div>
          <div>
            Thời gian: {successStart} – {successEnd}, {successDate}
          </div>
          <div>Trạng thái: {success.status || 'SCHEDULED'}</div>
        </Alert>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="danger" onClick={handleResetForm}>
            Tạo buổi tập khác
          </Button>
          <Button
            as={Link}
            to={`/manager/classes/${classId}`}
            variant="outline-secondary"
          >
            Quay lại chi tiết lớp
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

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo buổi tập</h1>
      <p className="text-muted mb-4">
        Tạo một buổi tập độc lập (không thuộc lịch cố định) cho lớp
        này.
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
            Lớp học đang ngưng hoạt động. Không thể tạo buổi tập
            cho lớp này. Vui lòng kích hoạt lại lớp trước khi tạo
            buổi tập.
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
      {roomAvailabilityError ? (
        <ErrorAlert error={roomAvailabilityError} title="Không kiểm tra được phòng khả dụng" />
      ) : null}

      <ErrorAlert
        error={serverError}
        title="Không tạo được buổi tập"
        onClose={serverError ? () => setServerError(null) : undefined}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group controlId="ssc-coachId">
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
                  ? availabilityStart && availabilityEnd
                    ? 'Không có huấn luyện viên phù hợp'
                    : 'Chọn ngày và giờ để tìm huấn luyện viên'
                  : '— Chọn huấn luyện viên —'}
            </option>
            {coachOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Chỉ hiển thị huấn luyện viên đang hoạt động và còn trống trong thời gian đã chọn.
          </Form.Text>
          <Form.Control.Feedback type="invalid">
            {errors.coachId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="ssc-roomId">
          <Form.Label>Phòng tập *</Form.Label>
          <Form.Select
            {...register('roomId')}
            isInvalid={Boolean(errors.roomId)}
            disabled={roomsLoading || roomAvailabilityLoading || !classIsActive}
          >
            <option value="">
              {roomsLoading
                ? 'Đang tải…'
                : roomOptions.length === 0
                  ? 'Không có phòng tập đang hoạt động'
                  : '— Chọn phòng tập —'}
            </option>
            {roomOptions.map((o) => (
              <option key={o.value} value={o.value} disabled={!o.available}>
                {o.label}
                {o.capacity != null ? ` (Sức chứa: ${o.capacity})` : ''}
                {o.availableCapacity != null ? ` · Còn ${o.availableCapacity} chỗ` : ''}
                {!o.available ? ' · Không khả dụng' : ''}
              </option>
            ))}
          </Form.Select>
          {selectedRoomCapacity != null ? (
            <Form.Text className="text-muted">
              Sức chứa phòng: {selectedRoomCapacity}. Vui lòng đặt sức
              chứa buổi tập không vượt quá con số này.
            </Form.Text>
          ) : null}
          <Form.Control.Feedback type="invalid">
            {errors.roomId?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="ssc-sessionDate">
          <Form.Label>Ngày buổi tập *</Form.Label>
          <RhfDateInput
            control={control}
            name="sessionDate"
            isInvalid={Boolean(errors.sessionDate)}
            disabled={!classIsActive}
          />
          <Form.Control.Feedback type="invalid">
            {errors.sessionDate?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="row mt-3 g-3">
          <Form.Group className="col-sm-6" controlId="ssc-startTime">
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
          <Form.Group className="col-sm-6" controlId="ssc-endTime">
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

        <Form.Group className="mt-3" controlId="ssc-capacity">
          <Form.Label>Sức chứa *</Form.Label>
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
            phòng đã chọn. Hệ thống sẽ kiểm tra lại khi tạo buổi tập.
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
              'Tạo buổi tập'
            )}
          </Button>
          <Button
            as={Link}
            to={`/manager/classes/${classId}`}
            type="button"
            variant="outline-secondary"
            disabled={isSubmitting}
          >
            Hủy
          </Button>
        </div>
      </Form>
    </div>
  );
}
