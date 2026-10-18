import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  applyRoomImpact,
  extendRoomSuspension,
  getRoom,
  listRoomSuspensions,
  listRooms,
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
  const [rooms, setRooms] = useState([]);
  const [extensionSuspension, setExtensionSuspension] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setError,
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
      const requests = [getRoom(roomId), listRooms()];
      if (extensionSuspensionId) requests.push(listRoomSuspensions(roomId));
      const [current, allRooms, suspensions = []] = await Promise.all(requests);
      setRoom(current);
      setRooms(allRooms);
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
      resolutions: [],
    };
    if (includeResolutions) {
      payload.resolutions = values.resolutions.map((resolution) => ({
        sessionId: resolution.sessionId,
        action: resolution.action,
        targetRoomId:
          resolution.action === 'MOVE' ? resolution.targetRoomId : null,
        startTime:
          resolution.action === 'RESCHEDULE'
            ? gymLocalDateToIsoInstant(resolution.startDate, resolution.startClock)
            : null,
        endTime:
          resolution.action === 'RESCHEDULE'
            ? gymLocalDateToIsoInstant(resolution.endDate, resolution.endClock)
            : null,
        reason: resolution.reason.trim() || null,
      }));
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
        setNotice(
          'Danh sách buổi bị ảnh hưởng đã thay đổi. Vui lòng chọn lại cách xử lý và xác nhận.',
        );
        return;
      }
      if (extensionSuspension) {
        const payload = impactPayload(values, true);
        await extendRoomSuspension(roomId, extensionSuspension.id, {
          expectedEndTime: extensionSuspension.endTime,
          endTime: payload.endTime,
          reason: values.reason.trim(),
          resolutions: payload.resolutions,
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

  const targetRooms = useMemo(
    () => rooms.filter((candidate) => candidate.id !== roomId && candidate.status === 'ACTIVE'),
    [roomId, rooms],
  );

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
                  <Form.Control type="date" min={getGymZoneTodayIsoDate()} readOnly={Boolean(extensionSuspension)} {...register('startDate')} isInvalid={Boolean(errors.startDate)} />
                  <Form.Control.Feedback type="invalid">{errors.startDate?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Giờ</Form.Label>
                  <Form.Control type="time" readOnly={Boolean(extensionSuspension)} {...register('startClock')} isInvalid={Boolean(errors.startClock)} />
                  <Form.Control.Feedback type="invalid">{errors.startClock?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Đến ngày</Form.Label>
                  <Form.Control type="date" min={getGymZoneTodayIsoDate()} {...register('endDate')} isInvalid={Boolean(errors.endDate)} />
                  <Form.Control.Feedback type="invalid">{errors.endDate?.message}</Form.Control.Feedback>
                </Col>
                <Col md={2}>
                  <Form.Label>Giờ</Form.Label>
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
              <Table responsive className="align-middle">
                <thead><tr><th>Buổi tập</th><th>Thời gian</th><th>Trạng thái / đặt chỗ</th><th>Xử lý</th><th>Chi tiết</th></tr></thead>
                <tbody>
                  {preview.sessions.map((session, index) => {
                    const action = resolutions[index]?.action || '';
                    return (
                      <tr key={session.sessionId}>
                        <td><Link to={`/manager/class-sessions/${session.sessionId}`}>{session.className}</Link></td>
                        <td>{formatGymDate(session.startTime)} · {formatGymTime(session.startTime)}–{formatGymTime(session.endTime)}</td>
                        <td>{session.status} · {session.bookingCount} lượt đặt</td>
                        <td style={{ minWidth: 180 }}>
                          <input type="hidden" {...register(`resolutions.${index}.sessionId`)} />
                          <Form.Select size="sm" {...register(`resolutions.${index}.action`)} isInvalid={Boolean(errors.resolutions?.[index]?.action)}>
                            <option value="">-- Chọn --</option>
                            <option value="MOVE">Chuyển phòng</option>
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
                                {targetRooms.map((target) => (
                                  <option key={target.id} value={target.id}>
                                    {target.name} ({target.capacity} chỗ)
                                  </option>
                                ))}
                              </Form.Select>
                              <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.targetRoomId?.message}</Form.Control.Feedback>
                            </>
                          ) : action === 'RESCHEDULE' ? (
                            <Row className="g-2">
                              <Col xs={7}>
                                <Form.Control size="sm" type="date" min={getGymZoneTodayIsoDate()} {...register(`resolutions.${index}.startDate`)} isInvalid={Boolean(errors.resolutions?.[index]?.startDate)} />
                                <Form.Control.Feedback type="invalid">{errors.resolutions?.[index]?.startDate?.message}</Form.Control.Feedback>
                              </Col>
                              <Col xs={5}>
                                <Form.Control size="sm" type="time" {...register(`resolutions.${index}.startClock`)} isInvalid={Boolean(errors.resolutions?.[index]?.startClock)} />
                              </Col>
                              <Col xs={7}>
                                <Form.Control size="sm" type="date" min={getGymZoneTodayIsoDate()} {...register(`resolutions.${index}.endDate`)} isInvalid={Boolean(errors.resolutions?.[index]?.endDate)} />
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
            )}
            <Button type="button" variant="danger" onClick={handleApply} disabled={applying || previewing}>
              {applying ? 'Đang áp dụng…' : 'Kiểm tra lại và áp dụng'}
            </Button>
          </Card.Body></Card>
        ) : null}
      </Form>
    </div>
  );
}
