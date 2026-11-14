import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import SessionDateSlotInput from '../../../components/common/SessionDateSlotInput';
import SessionTime from '../../../components/common/SessionTime';
import useCourseResourceAvailability from '../../../hooks/useCourseResourceAvailability';
import { rescheduleCourseRun } from '../../../services/courseAdminService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { getCourseErrorMessage } from '../../../utils/courseUi';

const local = value => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
const iso = value => new Date(`${value}:00+07:00`).toISOString();
const safeIso = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}:00+07:00`)) ? iso(value) : null;
const availabilityKey = (value, excluded) => JSON.stringify([value.startAt, value.endAt, excluded]);
const schema = z.object({ sessions: z.array(z.object({
  selected: z.boolean(), startAt: z.string(), endAt: z.string(), roomId: z.string(), coachId: z.string(),
}).superRefine((value, context) => {
  if (!value.selected) return;
  const start = Date.parse(`${value.startAt}:00+07:00`), end = Date.parse(`${value.endAt}:00+07:00`);
  if (!Number.isFinite(start) || start <= Date.now()) context.addIssue({ code: 'custom', path: ['startAt'], message: 'Chọn ngày giờ trong tương lai.' });
  if (!Number.isFinite(end) || end <= start) context.addIssue({ code: 'custom', path: ['endAt'], message: 'Kết thúc phải sau bắt đầu.' });
  if (!value.roomId) context.addIssue({ code: 'custom', path: ['roomId'], message: 'Chọn phòng còn trống.' });
  if (!value.coachId) context.addIssue({ code: 'custom', path: ['coachId'], message: 'Chọn HLV còn trống.' });
})) });

function SessionResources({ session, index, value, values, excluded, capacity, disabled, control, setValue, errors, onAvailability }) {
  const { field: roomField, fieldState: roomState, formState: { isSubmitted } } = useController({ control, name: `sessions.${index}.roomId` });
  const { field: coachField, fieldState: coachState } = useController({ control, name: `sessions.${index}.coachId` });
  const roomError = roomState.isTouched || isSubmitted ? errors?.roomId : null;
  const coachError = coachState.isTouched || isSubmitted ? errors?.coachId : null;
  const key = availabilityKey(value, excluded);
  const availability = useCourseResourceAvailability({
    windows: [{ startAt: safeIso(value.startAt), endAt: safeIso(value.endAt) }], capacity,
    excludeSessionIds: excluded, enabled: !disabled,
  });
  // The API ignores the old schedules of selected sessions. Check their proposed schedules here.
  const overlapping = values.filter((other, otherIndex) => otherIndex !== index && other.selected
    && other.startAt < value.endAt && other.endAt > value.startAt);
  const blockedRooms = JSON.stringify(overlapping.map(other => other.roomId));
  const blockedCoaches = JSON.stringify(overlapping.map(other => other.coachId));
  const rooms = useMemo(() => availability.rooms.filter(room => !JSON.parse(blockedRooms).includes(room.id)), [availability.rooms, blockedRooms]);
  const coaches = useMemo(() => availability.coaches.filter(coach => !JSON.parse(blockedCoaches).includes(coach.accountId)), [availability.coaches, blockedCoaches]);
  useEffect(() => { onAvailability(session.id, key, availability.ready); }, [session.id, key, availability.ready, onAvailability]);
  useEffect(() => {
    if (!availability.ready || disabled) return;
    if (value.roomId && !rooms.some(room => room.id === value.roomId)) setValue(`sessions.${index}.roomId`, '', { shouldValidate: roomState.isTouched || isSubmitted });
    if (value.coachId && !coaches.some(coach => coach.accountId === value.coachId)) setValue(`sessions.${index}.coachId`, '', { shouldValidate: coachState.isTouched || isSubmitted });
  }, [availability.ready, disabled, rooms, coaches, value.roomId, value.coachId, index, setValue, roomState.isTouched, coachState.isTouched, isSubmitted]);
  return <>
    <SessionDateSlotInput control={control} startName={`sessions.${index}.startAt`} endName={`sessions.${index}.endAt`} label={`Buổi ${session.unitNumber}`} />
    <div className="row g-2 mt-2">
      <div className="col-md-6"><Form.Label htmlFor={`batch-room-${session.id}`}>Phòng *</Form.Label>
        <Form.Select id={`batch-room-${session.id}`} aria-label={`Buổi ${session.unitNumber} - phòng`} disabled={!availability.ready} {...roomField} isInvalid={!!roomError}>
          <option value="">{!availability.ready ? 'Đang kiểm tra phòng…' : rooms.length ? 'Chọn phòng' : 'Không có phòng trống'}</option>
          {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
        </Form.Select><Form.Control.Feedback type="invalid">{roomError?.message}</Form.Control.Feedback>
      </div>
      <div className="col-md-6"><Form.Label htmlFor={`batch-coach-${session.id}`}>Huấn luyện viên *</Form.Label>
        <Form.Select id={`batch-coach-${session.id}`} aria-label={`Buổi ${session.unitNumber} - HLV`} disabled={!availability.ready} {...coachField} isInvalid={!!coachError}>
          <option value="">{!availability.ready ? 'Đang kiểm tra HLV…' : coaches.length ? 'Chọn HLV' : 'Không có HLV trống'}</option>
          {coaches.map(coach => <option key={coach.accountId} value={coach.accountId}>{coach.fullName}</option>)}
        </Form.Select><Form.Control.Feedback type="invalid">{coachError?.message}</Form.Control.Feedback>
      </div>
    </div>
    {availability.error && <Alert variant="danger" className="mt-2 mb-0">Không tải được phòng và HLV trống. <Button size="sm" variant="outline-danger" onClick={availability.retry}>Tải lại</Button></Alert>}
  </>;
}

export default function CourseSessionsRescheduleModal({ run, sessions, onClose, onSaved }) {
  // Keep versions and the timetable stable while the manager edits or retries.
  const [snapshot] = useState(() => ({ run, sessions }));
  const [editable] = useState(() => sessions.filter(session =>
    ['SCHEDULED', 'MAKEUP_SCHEDULED'].includes(session.status) && !session.replacementSessionId && Date.parse(session.startAt) > Date.now()));
  const pending = useRef(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(false), [error, setError] = useState('');
  const { control, register, setValue, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: {
    sessions: editable.map(session => ({ selected: false, startAt: local(session.startAt), endAt: local(session.endAt), roomId: session.roomId || '', coachId: session.coachId || '' })),
  } });
  const values = useWatch({ control, name: 'sessions' });
  const count = values.filter(value => value.selected).length;
  const excluded = editable.filter((_, index) => values[index].selected).map(session => session.id);
  const [availabilityStatus, setAvailabilityStatus] = useState({});
  const onAvailability = useCallback((id, key, ready) => setAvailabilityStatus(current =>
    current[id]?.key === key && current[id]?.ready === ready ? current : { ...current, [id]: { key, ready } }), []);
  const resourcesReady = editable.every((session, index) => !values[index].selected || (
    availabilityStatus[session.id]?.key === availabilityKey(values[index], excluded) && availabilityStatus[session.id]?.ready
    && values[index].roomId && values[index].coachId));

  async function submit(values) {
    if (lock.current) return;
    setError('');
    if (!pending.current) {
      if (!resourcesReady) { setError('Chờ kiểm tra và chọn phòng, HLV còn trống cho các buổi đã chọn.'); return; }
      const changes = editable.flatMap((session, index) => {
        const value = values.sessions[index];
        if (!value.selected || (value.startAt === local(session.startAt) && value.endAt === local(session.endAt) && value.roomId === session.roomId && value.coachId === session.coachId)) return [];
        return [{ sessionId: session.id, expectedVersion: session.version, startAt: iso(value.startAt), endAt: iso(value.endAt), roomId: value.roomId, coachId: value.coachId }];
      });
      if (!changes.length) { setError('Chọn buổi và thay đổi ngày hoặc khung giờ trước khi lưu.'); return; }
      const byId = new Map(changes.map(change => [change.sessionId, change]));
      const effective = snapshot.sessions.filter(session => session.status !== 'REMOVED_BY_RUN_CHANGE' && !session.replacementSessionId)
        .map(session => byId.get(session.id) || session);
      pending.current = { key: createCourseIdempotencyKey('course-reschedule'), payload: {
        expectedVersion: snapshot.run.version, totalUnits: snapshot.run.totalUnits,
        plannedStartAt: new Date(Math.min(...effective.map(session => Date.parse(session.startAt)))).toISOString(),
        plannedEndAt: new Date(Math.max(...effective.map(session => Date.parse(session.endAt)))).toISOString(),
        sessions: changes,
      } };
    }
    lock.current = true; setBusy(true);
    try {
      const result = await rescheduleCourseRun(snapshot.run.id, pending.current.payload, pending.current.key);
      await onSaved(result);
    } catch (err) {
      const uncertain = !err.response || err.response.status >= 500;
      setRetry(uncertain);
      if (!uncertain) pending.current = null;
      setError(getCourseErrorMessage(err, 'Chưa lưu được lịch. Kiểm tra trùng phòng, HLV và tải lại nếu dữ liệu đã thay đổi.'));
    } finally { lock.current = false; setBusy(false); }
  }

  return <Modal show centered scrollable size="lg" backdrop="static" keyboard={false} onHide={() => { if (!busy && !retry) onClose(); }}>
    <Form noValidate onSubmit={event => handleSubmit(submit)(event)} className="d-flex flex-column overflow-hidden">
      <Modal.Header closeButton={!busy && !retry}><Modal.Title>Dời nhiều buổi</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {retry && <Alert variant="warning">Chưa xác định kết quả. Thử lại để gửi đúng lịch vừa lưu.</Alert>}
        <fieldset disabled={busy || retry}>
          {editable.map((session, index) => <section key={session.id} className="border rounded p-3 mb-3">
            <Form.Check id={`move-session-${session.id}`} label={`Buổi ${session.unitNumber}${session.isMakeup ? ' · Học bù' : ''}`} {...register(`sessions.${index}.selected`)} />
            <div className="small text-muted my-2">{session.roomName} · {session.coachName}</div>
            {values[index]?.selected
              ? <SessionResources session={session} index={index} value={values[index]} values={values} excluded={excluded} capacity={snapshot.run.capacity}
                  disabled={busy || retry} control={control} setValue={setValue} errors={errors.sessions?.[index]} onAvailability={onAvailability} />
              : <SessionTime startAt={session.startAt} endAt={session.endAt} />}
          </section>)}
          {!editable.length && <p>Không có buổi chưa bắt đầu để dời lịch.</p>}
        </fieldset>
      </Modal.Body>
      <Modal.Footer>
        <span className="me-auto text-muted">Đã chọn {count} buổi</span>
        <Button variant="secondary" disabled={busy || retry} onClick={onClose}>Đóng</Button>
        <Button type="submit" disabled={busy || !count || (!retry && !resourcesReady)}>{busy ? 'Đang lưu…' : retry ? 'Thử lại' : 'Lưu tất cả'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}
