import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { RhfDateInput } from '../../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  applyRoomImpact,
  extendRoomSuspension,
  getRoom,
  listRoomSuspensions,
  previewRoomImpact,
} from '../../../services/roomService';
import {
  formatGymDate,
  formatGymTime,
  getGymLocalIsoDate,
  getGymZoneTodayIsoDate,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';

const impactSchema = z
  .object({
    mode: z.enum(['TEMPORARY', 'PERMANENT']),
    startDate: z.string(),
    startClock: z.string(),
    endDate: z.string(),
    endClock: z.string(),
    reason: z.string().max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
    resolutions: z.array(
      z.object({
        sessionId: z.string(),
        action: z.string(),
        targetRoomId: z.string(),
        startDate: z.string(),
        startClock: z.string(),
        endDate: z.string(),
        endClock: z.string(),
        reason: z.string().max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== 'TEMPORARY') return;
    for (const field of ['startDate', 'startClock', 'endDate', 'endClock']) {
      if (!data[field]) {
        ctx.addIssue({ path: [field], code: 'custom', message: 'Bắt buộc.' });
      }
    }
    const start = gymLocalDateToIsoInstant(data.startDate, data.startClock);
    const end = gymLocalDateToIsoInstant(data.endDate, data.endClock);
    if (start && end && end <= start) {
      ctx.addIssue({
        path: ['endClock'],
        code: 'custom',
        message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.',
      });
    }
  });

const DEFAULTS = {
  mode: 'TEMPORARY',
  startDate: '',
  startClock: '',
  endDate: '',
  endClock: '',
  reason: '',
  resolutions: [],
};

function emptyResolution(session) {
  return {
    sessionId: session.sessionId,
    action: '',
    targetRoomId: '',
    startDate: getGymLocalIsoDate(session.startTime),
    startClock: formatGymTime(session.startTime).replace('24:00', '00:00'),
    endDate: getGymLocalIsoDate(session.endTime),
    endClock: formatGymTime(session.endTime).replace('24:00', '00:00'),
    reason: '',
  };
}

function sameIds(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function includesTargetRoom(targetRooms, roomId) {
  return Array.isArray(targetRooms)
    && targetRooms.some((room) => room.roomId === roomId);
}

function mergeFreshResolutions(freshSessions, currentResolutions) {
  const currentBySessionId = new Map(
    currentResolutions.map((resolution) => [resolution.sessionId, resolution]),
  );
  return freshSessions.map((session) => {
    const current = currentBySessionId.get(session.sessionId)
      || emptyResolution(session);
    if (
      current.action === 'MOVE'
      && !includesTargetRoom(session.availableTargetRooms, current.targetRoomId)
    ) {
      return { ...current, targetRoomId: '' };
    }
    return current;
  });
}

function resolutionPayload(resolution) {
  return {
    sessionId: resolution.sessionId,
    action: resolution.action,
    targetRoomId: resolution.action === 'MOVE' ? resolution.targetRoomId : null,
    startTime: resolution.action === 'RESCHEDULE'
      ? gymLocalDateToIsoInstant(resolution.startDate, resolution.startClock)
      : null,
    endTime: resolution.action === 'RESCHEDULE'
      ? gymLocalDateToIsoInstant(resolution.endDate, resolution.endClock)
      : null,
    reason: resolution.reason.trim() || null,
  };
}

function matchesBulkResolution(resolution, bulkResolution) {
  if (resolution.action !== bulkResolution.action) return false;
  if (resolution.action === 'MOVE') {
    return resolution.targetRoomId === bulkResolution.targetRoomId;
  }
  if (resolution.action === 'CANCEL') {
    return (resolution.reason.trim() || null) === bulkResolution.reason;
  }
  return false;
}

const ROOM_ERROR_MESSAGES = {
  ROOM_SUSPENSION_CHANGED:
    'Khoảng tạm ngưng vừa được cập nhật ở nơi khác. Dữ liệu đã được tải lại; vui lòng xem trước lại trước khi xác nhận.',
  ROOM_SUSPENSION_EXPIRED:
    'Khoảng tạm ngưng đã kết thúc nên không thể gia hạn.',
  ROOM_SUSPENSION_CONFLICT:
    'Khoảng thời gian mới xung đột với một lần tạm ngưng khác của phòng.',
  ROOM_HAS_IN_PROGRESS_SESSION:
    'Phòng đang có buổi tập diễn ra nên chưa thể thực hiện thao tác này.',
  SESSION_NOT_SCHEDULED:
    'Một buổi tập vừa thay đổi trạng thái. Vui lòng xem trước lại danh sách ảnh hưởng.',
};

const SESSION_STATUS_LABELS = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

function localizedRoomError(error) {
  const message = ROOM_ERROR_MESSAGES[error?.response?.data?.code];
  return message ? { message } : error;
}

export default function RoomImpactPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const extensionSuspensionId = searchParams.get('extensionSuspensionId');
  const [room, setRoom] = useState(null);
  const [extensionSuspension, setExtensionSuspension] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkTargetRoomId, setBulkTargetRoomId] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [appliedBulkResolution, setAppliedBulkResolution] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    clearErrors,
    getValues,
    reset,
    setError,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(impactSchema),
    defaultValues: DEFAULTS,
  });
  const mode = useWatch({ control, name: 'mode' });
  const resolutions = useWatch({ control, name: 'resolutions' }) || [];

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const requests = [getRoom(roomId)];
      if (extensionSuspensionId) requests.push(listRoomSuspensions(roomId));
      const [current, suspensions = []] = await Promise.all(requests);
      setRoom(current);
      if (extensionSuspensionId) {
        const suspension = suspensions.find(
          (item) => item.id === extensionSuspensionId,
        );
        if (!suspension || new Date(suspension.endTime).getTime() <= Date.now()) {
          throw new Error('Khoảng tạm ngưng cần gia hạn không còn hiệu lực.');
        }
        setExtensionSuspension(suspension);
        reset({
          ...DEFAULTS,
          startDate: getGymLocalIsoDate(suspension.endTime),
          startClock: formatGymTime(suspension.endTime).replace('24:00', '00:00'),
          endDate: getGymLocalIsoDate(suspension.endTime),
          endClock: formatGymTime(suspension.endTime).replace('24:00', '00:00'),
        });
      }
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [extensionSuspensionId, reset, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  function impactPayload(values, includeResolutions = false) {
    const permanentDisable = values.mode === 'PERMANENT';
    const payload = {
      startTime: permanentDisable
        ? null
        : gymLocalDateToIsoInstant(values.startDate, values.startClock),
      endTime: permanentDisable
        ? null
        : gymLocalDateToIsoInstant(values.endDate, values.endClock),
      permanentDisable,
      reason: values.reason.trim() || null,
    };
    if (includeResolutions) {
      if (appliedBulkResolution) {
        payload.bulkResolution = appliedBulkResolution;
        payload.resolutionOverrides = values.resolutions
          .filter((resolution) => !matchesBulkResolution(resolution, appliedBulkResolution))
          .map(resolutionPayload);
      } else {
        payload.resolutions = values.resolutions.map(resolutionPayload);
      }
    }
    return payload;
  }

  async function onPreview(values) {
    setActionError(null);
    setNotice(null);
    setPreviewing(true);
    try {
      const result = await previewRoomImpact(roomId, impactPayload(values));
      setPreview(result);
      setBulkAction('');
      setBulkTargetRoomId('');
      setBulkReason('');
      setBulkError('');
      setAppliedBulkResolution(null);
      reset({
        ...values,
        resolutions: result.sessions.map(emptyResolution),
      });
    } catch (error) {
      setActionError(localizedRoomError(error));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!(await trigger())) return;
    const values = getValues();
    setActionError(null);
    setNotice(null);
    let invalid = false;
    if (extensionSuspension && !values.reason.trim()) {
      setError('reason', {
        type: 'manual',
        message: 'Vui lòng nhập lý do gia hạn.',
      });
      invalid = true;
    }
    values.resolutions.forEach((resolution, index) => {
      if (!resolution.action) {
        setError(`resolutions.${index}.action`, {
          type: 'manual',
          message: 'Vui lòng chọn cách xử lý.',
        });
        invalid = true;
      } else if (resolution.action === 'MOVE' && !resolution.targetRoomId) {
        setError(`resolutions.${index}.targetRoomId`, {
          type: 'manual',
          message: 'Vui lòng chọn phòng đích.',
        });
        invalid = true;
      } else if (
        resolution.action === 'MOVE'
        && !includesTargetRoom(
          preview?.sessions?.[index]?.availableTargetRooms,
          resolution.targetRoomId,
        )
      ) {
        setError(`resolutions.${index}.targetRoomId`, {
          type: 'manual',
          message: 'Phòng đích không còn phù hợp với buổi tập này.',
        });
        invalid = true;
      } else if (resolution.action === 'CANCEL' && !resolution.reason.trim()) {
        setError(`resolutions.${index}.reason`, {
          type: 'manual',
          message: 'Vui lòng nhập lý do hủy.',
        });
        invalid = true;
      } else if (resolution.action === 'RESCHEDULE') {
        const start = gymLocalDateToIsoInstant(
          resolution.startDate,
          resolution.startClock,
        );
        const end = gymLocalDateToIsoInstant(
          resolution.endDate,
          resolution.endClock,
        );
        if (!start || !end) {
          setError(`resolutions.${index}.startDate`, {
            type: 'manual',
            message: 'Vui lòng nhập đủ thời gian mới.',
          });
          invalid = true;
        } else {
          const durationMinutes = (new Date(end) - new Date(start)) / 60000;
          if (durationMinutes < 30 || durationMinutes > 90) {
            setError(`resolutions.${index}.endClock`, {
              type: 'manual',
              message: 'Thời lượng buổi tập phải từ 30 đến 90 phút.',
            });
            invalid = true;
          }
        }
        if (!resolution.reason.trim()) {
          setError(`resolutions.${index}.reason`, {
            type: 'manual',
            message: 'Vui lòng nhập lý do dời lịch.',
          });
          invalid = true;
        }
      }
    });
    if (invalid) return;

    setConfirmOpen(true);
  }

  async function confirmApply() {
    const values = getValues();
    setConfirmOpen(false);
    setApplying(true);
    try {
      const fresh = await previewRoomImpact(roomId, impactPayload(values));
      const previousIds = (preview?.sessions || []).map((session) => session.sessionId);
      const freshIds = fresh.sessions.map((session) => session.sessionId);
      if (!sameIds(previousIds, freshIds)) {
        setPreview(fresh);
        reset({
          ...values,
          resolutions: fresh.sessions.map(emptyResolution),
        });
        setAppliedBulkResolution(null);
        setNotice(
          'Danh sách buổi bị ảnh hưởng đã thay đổi. Vui lòng chọn lại cách xử lý và xác nhận.',
        );
        return;
      }

      const bulkMoveInvalid = appliedBulkResolution?.action === 'MOVE'
        && !includesTargetRoom(
          fresh.bulkAvailableTargetRooms,
          appliedBulkResolution.targetRoomId,
        );
      const invalidSessionMove = values.resolutions.some((resolution) => {
        if (resolution.action !== 'MOVE') return false;
        const session = fresh.sessions.find(
          (candidate) => candidate.sessionId === resolution.sessionId,
        );
        return !includesTargetRoom(
          session?.availableTargetRooms,
          resolution.targetRoomId,
        );
      });
      if (bulkMoveInvalid || invalidSessionMove) {
        setPreview(fresh);
        reset({
          ...values,
          resolutions: mergeFreshResolutions(fresh.sessions, values.resolutions),
        });
        if (bulkMoveInvalid) {
          setBulkTargetRoomId('');
          setAppliedBulkResolution(null);
        }
        setNotice(
          'Danh sách phòng phù hợp vừa thay đổi. Phòng không còn khả dụng đã được bỏ chọn; vui lòng kiểm tra lại.',
        );
        return;
      }
      if (extensionSuspension) {
        const payload = impactPayload(values, true);
        await extendRoomSuspension(roomId, extensionSuspension.id, {
          expectedEndTime: extensionSuspension.endTime,
          endTime: payload.endTime,
          reason: values.reason.trim(),
          ...(payload.bulkResolution
            ? {
                bulkResolution: payload.bulkResolution,
                resolutionOverrides: payload.resolutionOverrides,
              }
            : { resolutions: payload.resolutions }),
        });
      } else {
        await applyRoomImpact(roomId, impactPayload(values, true));
      }
      navigate(`/manager/rooms/${roomId}`, {
        replace: true,
        state: {
          notice: extensionSuspension
            ? 'Đã gia hạn khoảng tạm ngưng và xử lý các buổi bị ảnh hưởng.'
            : 'Đã áp dụng xử lý ảnh hưởng của phòng.',
        },
      });
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === 'ROOM_SUSPENSION_CHANGED') {
        setPreview(null);
        await load();
      }
      setActionError(localizedRoomError(error));
    } finally {
      setApplying(false);
    }
  }

  const bulkTargetRooms = preview?.bulkAvailableTargetRooms || [];
  const allAffectedSessionsScheduled = useMemo(
    () => (preview?.sessions || []).every((session) => session.status === 'SCHEDULED'),
    [preview],
  );

  function applyBulkResolution() {
    if (!bulkAction) {
      setBulkError('Vui lòng chọn cách xử lý chung.');
      return;
    }
    if (bulkAction === 'MOVE' && !bulkTargetRoomId) {
      setBulkError(
        bulkTargetRooms.length === 0
          ? 'Không có phòng phù hợp cho toàn bộ các buổi.'
          : 'Vui lòng chọn phòng đích.',
      );
      return;
    }
    if (
      bulkAction === 'MOVE'
      && !includesTargetRoom(bulkTargetRooms, bulkTargetRoomId)
    ) {
      setBulkError('Phòng đích không còn phù hợp cho toàn bộ các buổi.');
      return;
    }
    if (bulkAction === 'CANCEL' && !bulkReason.trim()) {
      setBulkError('Vui lòng nhập lý do hủy chung.');
      return;
    }

    const updated = resolutions.map((resolution) => ({
      ...resolution,
      action: bulkAction,
      targetRoomId: bulkAction === 'MOVE' ? bulkTargetRoomId : '',
      reason: bulkAction === 'CANCEL' ? bulkReason.trim() : '',
    }));
    setValue('resolutions', updated, { shouldDirty: true, shouldValidate: true });
    setAppliedBulkResolution({
      action: bulkAction,
      targetRoomId: bulkAction === 'MOVE' ? bulkTargetRoomId : null,
      reason: bulkAction === 'CANCEL' ? bulkReason.trim() : null,
    });
    clearErrors('resolutions');
    setBulkError('');
    setNotice(
      bulkAction === 'MOVE'
        ? `Đã chọn chuyển toàn bộ ${updated.length} buổi sang phòng đích.`
        : `Đã chọn hủy toàn bộ ${updated.length} buổi bị ảnh hưởng.`,
    );
  }

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  }
  if (loadError || !room) {
    return <><ErrorAlert error={loadError} title="Không tải được phòng" /><Link to="/manager/rooms">← Quay lại</Link></>;
  }

  return (
    <div>
      <Link to={`/manager/rooms/${roomId}`} className="small text-decoration-none">
        ← Quay lại chi tiết phòng
      </Link>
      <h1 className="h3 fw-bold mt-2 mb-1">Xử lý ảnh hưởng phòng {room.name}</h1>
      <p className="text-muted">
        Xem trước toàn bộ buổi bị ảnh hưởng rồi chuyển phòng, dời lịch hoặc hủy
        từng buổi theo trạng thái hiện tại.
      </p>

      <ErrorAlert error={actionError} title="Không xử lý được ảnh hưởng phòng" onClose={() => setActionError(null)} />
      {notice ? <Alert variant="warning">{notice}</Alert> : null}
      {extensionSuspension ? (
        <Alert variant="info">
          Bạn đang gia hạn khoảng tạm ngưng đang có. Thời điểm bắt đầu xử lý là
          mốc kết thúc hiện tại; hãy chọn mốc kết thúc mới.
        </Alert>
      ) : null}

      <Form onSubmit={handleSubmit(onPreview)} noValidate>
        <Card className="border-0 shadow-sm mb-3"><Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Loại thao tác</Form.Label>
              {extensionSuspension ? (
                <>
                  <input type="hidden" {...register('mode')} />
                  <Form.Control value="Gia hạn khoảng tạm ngưng hiện tại" readOnly />
                </>
              ) : (
                <Form.Select {...register('mode')}>
                  <option value="TEMPORARY">Tạm ngưng theo khoảng thời gian</option>
                  <option value="PERMANENT">Ngưng hoạt động vĩnh viễn</option>
                </Form.Select>
              )}
            </Col>
            {mode === 'TEMPORARY' ? (
              <>
                <Col md={2}>
                  <Form.Label>Từ ngày</Form.Label>
                  <RhfDateInput control={control} name="startDate" min={getGymZoneTodayIsoDate()} readOnly={Boolean(extensionSuspension)} isInvalid={Boolean(errors.startDate)} />
                  <Form.Control.Feedback type="invalid">{errors.startDate?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Giờ bắt đầu</Form.Label>
                  <Form.Control type="time" readOnly={Boolean(extensionSuspension)} {...register('startClock')} isInvalid={Boolean(errors.startClock)} />
                  <Form.Control.Feedback type="invalid">{errors.startClock?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Đến ngày</Form.Label>
                  <RhfDateInput control={control} name="endDate" min={getGymZoneTodayIsoDate()} isInvalid={Boolean(errors.endDate)} />
                  <Form.Control.Feedback type="invalid">{errors.endDate?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Giờ kết thúc</Form.Label>
                  <Form.Control type="time" {...register('endClock')} isInvalid={Boolean(errors.endClock)} />
                  <Form.Control.Feedback type="invalid">{errors.endClock?.message}</Form.Control.Feedback>
                </Col>
              </>
            ) : null}
            <Col xs={12}>
              <Form.Label>Lý do chung</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={1000} {...register('reason')} isInvalid={Boolean(errors.reason)} />
              <Form.Control.Feedback type="invalid">{errors.reason?.message}</Form.Control.Feedback>
            </Col>
          </Row>
          <Button type="submit" variant="outline-danger" className="mt-3" disabled={previewing || applying}>
            {previewing ? 'Đang xem trước…' : 'Xem trước ảnh hưởng'}
          </Button>
        </Card.Body></Card>

        {preview ? (
          <Card className="border-0 shadow-sm"><Card.Body>
            <h2 className="h5">{preview.count} buổi tập bị ảnh hưởng</h2>
            {preview.sessions.length === 0 ? (
              <Alert variant="success">Không có buổi tập cần xử lý. Bạn có thể áp dụng ngay.</Alert>
            ) : (
              <>
                <Card className="border bg-light mb-3">
                  <Card.Body>
                    <h3 className="h6 fw-bold">Áp dụng cho tất cả buổi tập</h3>
                    <p className="small text-muted mb-3">
                      Dùng khi toàn bộ buổi bị ảnh hưởng có cùng cách xử lý. Bạn vẫn có thể chỉnh riêng từng dòng sau đó.
                    </p>
                    <Row className="g-2 align-items-end">
                      <Col md={3}>
                        <Form.Label className="small">Cách xử lý chung</Form.Label>
                        <Form.Select
                          size="sm"
                          value={bulkAction}
                          onChange={(event) => {
                            setBulkAction(event.target.value);
                            setBulkError('');
                            setAppliedBulkResolution(null);
                          }}
                        >
                          <option value="">-- Chọn --</option>
                          <option value="MOVE" disabled={bulkTargetRooms.length === 0}>
                            Chuyển cùng một phòng
                          </option>
                          {allAffectedSessionsScheduled ? <option value="CANCEL">Hủy tất cả buổi</option> : null}
                        </Form.Select>
                      </Col>
                      {bulkAction === 'MOVE' ? (
                        <Col md={5}>
                          <Form.Label className="small">Phòng đích</Form.Label>
                          <Form.Select size="sm" value={bulkTargetRoomId} onChange={(event) => { setBulkTargetRoomId(event.target.value); setAppliedBulkResolution(null); }}>
                            <option value="">-- Chọn phòng đích --</option>
                            {bulkTargetRooms.map((target) => (
                              <option key={target.roomId} value={target.roomId}>
                                {target.roomName} ({target.capacity} chỗ)
                              </option>
                            ))}
                          </Form.Select>
                          {bulkTargetRooms.length === 0 ? (
                            <div className="small text-muted mt-1">
                              Không có phòng phù hợp cho toàn bộ các buổi.
                            </div>
                          ) : null}
                        </Col>
                      ) : null}
                      {bulkAction === 'CANCEL' ? (
                        <Col md={5}>
                          <Form.Label className="small">Lý do hủy chung</Form.Label>
                          <Form.Control size="sm" maxLength={1000} value={bulkReason} onChange={(event) => { setBulkReason(event.target.value); setAppliedBulkResolution(null); }} />
                        </Col>
                      ) : null}
                      <Col md="auto">
                        <Button type="button" size="sm" variant="outline-danger" onClick={applyBulkResolution}>
                          Áp dụng cho tất cả
                        </Button>
                      </Col>
                    </Row>
                    {bulkError ? <div className="text-danger small mt-2">{bulkError}</div> : null}
                    {appliedBulkResolution ? (
                      <div className="text-success small mt-2">
                        Đã bật xử lý hàng loạt; các dòng chỉnh khác sẽ được gửi riêng dưới dạng ngoại lệ.
                      </div>
                    ) : null}
                  </Card.Body>
                </Card>

                <Table responsive className="align-middle">
                <thead><tr><th>Buổi tập</th><th>Thời gian</th><th>Trạng thái / đặt chỗ</th><th>Xử lý</th><th>Chi tiết</th></tr></thead>
                <tbody>
                  {preview.sessions.map((session, index) => {
                    const action = resolutions[index]?.action || '';
                    const sessionTargetRooms = session.availableTargetRooms || [];
                    return (
                      <tr key={session.sessionId}>
                        <td><Link to={`/manager/class-sessions/${session.sessionId}`}>{session.className}</Link></td>
                        <td>{formatGymDate(session.startTime)} · {formatGymTime(session.startTime)}–{formatGymTime(session.endTime)}</td>
                        <td>{SESSION_STATUS_LABELS[session.status] || 'Không xác định'} · {session.bookingCount} lượt đặt</td>
                        <td style={{ minWidth: 180 }}>
                          <input type="hidden" {...register(`resolutions.${index}.sessionId`)} />
                          <Form.Select size="sm" {...register(`resolutions.${index}.action`)} isInvalid={Boolean(errors.resolutions?.[index]?.action)}>
                            <option value="">-- Chọn --</option>
                            <option value="MOVE" disabled={sessionTargetRooms.length === 0}>
                              Chuyển phòng
                            </option>
                            {session.status === 'SCHEDULED' ? <option value="RESCHEDULE">Dời lịch</option> : null}
                            {session.status === 'SCHEDULED' ? <option value="CANCEL">Hủy buổi</option> : null}
                          </Form.Select>
                          <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.action?.message}</Form.Control.Feedback>
                        </td>
                        <td style={{ minWidth: 240 }}>
                          {action === 'MOVE' ? (
                            <>
                              <Form.Select size="sm" {...register(`resolutions.${index}.targetRoomId`)} isInvalid={Boolean(errors.resolutions?.[index]?.targetRoomId)}>
                                <option value="">-- Phòng đích --</option>
                                {sessionTargetRooms.map((target) => (
                                  <option key={target.roomId} value={target.roomId}>
                                    {target.roomName} ({target.capacity} chỗ)
                                  </option>
                                ))}
                              </Form.Select>
                              {sessionTargetRooms.length === 0 ? (
                                <div className="small text-muted mt-1">
                                  Không có phòng phù hợp cho buổi này.
                                </div>
                              ) : null}
                              <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.targetRoomId?.message}</Form.Control.Feedback>
                            </>
                          ) : action === 'RESCHEDULE' ? (
                            <Row className="g-2">
                              <Col xs={7}>
                                <RhfDateInput control={control} name={`resolutions.${index}.startDate`} size="sm" min={getGymZoneTodayIsoDate()} isInvalid={Boolean(errors.resolutions?.[index]?.startDate)} />
                                <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.startDate?.message}</Form.Control.Feedback>
                              </Col>
                              <Col xs={5}>
                                <Form.Control size="sm" type="time" {...register(`resolutions.${index}.startClock`)} isInvalid={Boolean(errors.resolutions?.[index]?.startClock)} />
                              </Col>
                              <Col xs={7}>
                                <RhfDateInput control={control} name={`resolutions.${index}.endDate`} size="sm" min={getGymZoneTodayIsoDate()} isInvalid={Boolean(errors.resolutions?.[index]?.endDate)} />
                              </Col>
                              <Col xs={5}>
                                <Form.Control size="sm" type="time" {...register(`resolutions.${index}.endClock`)} isInvalid={Boolean(errors.resolutions?.[index]?.endClock)} />
                                <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.endClock?.message}</Form.Control.Feedback>
                              </Col>
                              <Col xs={12}>
                                <Form.Control size="sm" maxLength={1000} placeholder="Lý do dời lịch" {...register(`resolutions.${index}.reason`)} isInvalid={Boolean(errors.resolutions?.[index]?.reason)} />
                                <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.reason?.message}</Form.Control.Feedback>
                              </Col>
                            </Row>
                          ) : action === 'CANCEL' ? (
                            <>
                              <Form.Control size="sm" maxLength={1000} placeholder="Lý do hủy" {...register(`resolutions.${index}.reason`)} isInvalid={Boolean(errors.resolutions?.[index]?.reason)} />
                              <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.reason?.message}</Form.Control.Feedback>
                            </>
                          ) : <span className="text-muted small">Chọn cách xử lý.</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </Table>
              </>
            )}
            <Button type="button" variant="danger" onClick={handleApply} disabled={applying || previewing}>
              {applying ? 'Đang áp dụng…' : 'Kiểm tra lại và áp dụng'}
            </Button>
          </Card.Body></Card>
        ) : null}
      </Form>

      <Modal show={confirmOpen} onHide={() => (applying ? null : setConfirmOpen(false))} centered>
        <Modal.Header closeButton={!applying}>
          <Modal.Title>Xác nhận xử lý ảnh hưởng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Thao tác này sẽ {mode === 'PERMANENT' ? 'ngưng hoạt động phòng vĩnh viễn' : 'tạm ngưng phòng'} và xử lý các buổi tập như sau:</p>
          <ul className="mb-0">
            <li>{resolutions.filter((item) => item.action === 'MOVE').length} buổi chuyển phòng</li>
            <li>{resolutions.filter((item) => item.action === 'RESCHEDULE').length} buổi dời lịch</li>
            <li>{resolutions.filter((item) => item.action === 'CANCEL').length} buổi bị hủy</li>
            <li>{(preview?.sessions || []).reduce((sum, item) => sum + Number(item.bookingCount || 0), 0)} lượt đặt bị ảnh hưởng</li>
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmOpen(false)} disabled={applying}>Quay lại</Button>
          <Button variant="danger" onClick={confirmApply} disabled={applying}>
            {applying ? 'Đang áp dụng…' : 'Xác nhận áp dụng'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
