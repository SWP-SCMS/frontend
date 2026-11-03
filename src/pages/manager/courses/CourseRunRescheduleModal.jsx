import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import CourseDateTimeInput from '../../../components/common/CourseDateTimeInput';
import { rescheduleCourseRun } from '../../../services/courseAdminService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { courseRunScheduleSchema } from '../../../schemas/courseSchemas';
import { getCourseErrorMessage } from '../../../utils/courseUi';

const local = (value) => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
const iso = (value) => new Date(`${value}:00+07:00`).toISOString();
const schema = courseRunScheduleSchema.safeExtend({ sessions: z.array(z.object({
  startAt: z.string().refine(v => Number.isFinite(Date.parse(v)), 'Ngày giờ không hợp lệ.'),
  endAt: z.string().refine(v => Number.isFinite(Date.parse(v)), 'Ngày giờ không hợp lệ.'),
}).refine(v => v.startAt < v.endAt, { path: ['endAt'], message: 'Kết thúc phải sau bắt đầu.' })) });

export default function CourseRunRescheduleModal({ run, sessions, onClose, onSaved }) {
  const [editable] = useState(() => sessions.filter(s => ['SCHEDULED', 'MAKEUP_SCHEDULED'].includes(s.status) && Date.parse(s.startAt) > Date.now()));
  const pending = useRef(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(false);
  const { control, register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: {
    plannedStartAt: local(run.plannedStartAt), plannedEndAt: local(run.plannedEndAt), totalUnits: run.totalUnits,
    sessions: editable.map(s => ({ startAt: local(s.startAt), endAt: local(s.endAt) })),
  } });
  async function submit(values) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    pending.current ||= { key: createCourseIdempotencyKey('course-reschedule'), payload: {
      expectedVersion: run.version, plannedStartAt: iso(values.plannedStartAt), plannedEndAt: iso(values.plannedEndAt), totalUnits: values.totalUnits,
      sessions: editable.flatMap((s, i) => {
        const value = values.sessions[i];
        if (s.unitNumber > values.totalUnits || (value.startAt === local(s.startAt) && value.endAt === local(s.endAt))) return [];
        return [{ sessionId: s.id, expectedVersion: s.version, startAt: iso(value.startAt), endAt: iso(value.endAt) }];
      }),
    } };
    try {
      const result = await rescheduleCourseRun(run.id, pending.current.payload, pending.current.key);
      await onSaved(result);
    } catch (e) {
      const uncertain = !e.response || e.response.status >= 500;
      setRetry(uncertain);
      if (!uncertain) pending.current = null;
      setError(getCourseErrorMessage(e, 'Không áp dụng được lịch. Kiểm tra khung đợt học và lịch từng buổi; tải lại nếu dữ liệu đã thay đổi.'));
    } finally { lock.current = false; setBusy(false); }
  }
  return <Modal show size="lg" onHide={() => { if (!busy && !retry) onClose(); }} backdrop="static" keyboard={false}>
    <Form noValidate onSubmit={event => handleSubmit(submit)(event)}><Modal.Header closeButton={!busy && !retry}><Modal.Title>Áp dụng lịch đợt học</Modal.Title></Modal.Header><Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      {retry && <Alert variant="warning">Chưa xác định kết quả. Bấm thử lại để gửi đúng lịch vừa xác nhận, tránh tạo thay đổi trùng.</Alert>}
      <p>Chỉnh khung đợt học và lịch các buổi bên dưới. Các buổi giữ lại phải nằm trong khung mới. Toàn bộ thay đổi được áp dụng cùng nhau; buổi đã bắt đầu giữ nguyên.</p>
      <fieldset disabled={busy || retry}>
        <CourseDateTimeInput control={control} name="plannedStartAt" label="Khai giảng" />
        <p className="text-danger">{errors.plannedStartAt?.message}</p>
        <CourseDateTimeInput control={control} name="plannedEndAt" label="Kết thúc" />
        <p className="text-danger">{errors.plannedEndAt?.message}</p>
        <Form.Label htmlFor="reschedule-units">Số buổi giữ lại</Form.Label><Form.Control id="reschedule-units" type="number" min="1" max={run.totalUnits} {...register('totalUnits')} />
        <p className="text-danger">{errors.totalUnits?.message}</p>
        {editable.map((s, i) => <section key={s.id} className="border rounded p-3 mt-3">
          <h3 className="h6">Buổi {s.unitNumber}{s.isMakeup ? ' · Học bù' : ''} · {s.roomName} · {s.coachName}</h3>
          <CourseDateTimeInput control={control} name={`sessions.${i}.startAt`} label={`Buổi ${s.unitNumber} bắt đầu`} />
          <p className="text-danger">{errors.sessions?.[i]?.startAt?.message}</p>
          <CourseDateTimeInput control={control} name={`sessions.${i}.endAt`} label={`Buổi ${s.unitNumber} kết thúc`} />
          <p className="text-danger">{errors.sessions?.[i]?.endAt?.message}</p>
        </section>)}
      </fieldset>
    </Modal.Body><Modal.Footer><Button type="submit" disabled={busy}>{retry ? 'Thử lại lịch đã xác nhận' : 'Xác nhận áp dụng toàn bộ lịch'}</Button></Modal.Footer></Form>
  </Modal>;
}
