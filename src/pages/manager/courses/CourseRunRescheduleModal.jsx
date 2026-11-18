import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import CourseDateTimeInput from '../../../components/common/CourseDateTimeInput';
import { rescheduleCourseRun } from '../../../services/courseAdminService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { courseRunScheduleSchema } from '../../../schemas/courseSchemas';
import { getCourseErrorMessage } from '../../../utils/courseUi';

const local = (value) => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
const iso = (value) => new Date(`${value}:00+07:00`).toISOString();
export default function CourseRunRescheduleModal({ run, onClose, onSaved }) {
  const pending = useRef(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(false);
  const { control, register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(courseRunScheduleSchema), defaultValues: {
    plannedStartAt: local(run.plannedStartAt), plannedEndAt: local(run.plannedEndAt), totalUnits: run.totalUnits,
  } });
  async function submit(values) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    pending.current ||= { key: createCourseIdempotencyKey('course-reschedule'), payload: {
      expectedVersion: run.version, plannedStartAt: iso(values.plannedStartAt), plannedEndAt: iso(values.plannedEndAt), totalUnits: values.totalUnits,
      sessions: [],
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
  return <Modal show centered size="lg" onHide={() => { if (!busy && !retry) onClose(); }} backdrop="static" keyboard={false}>
    <Form noValidate onSubmit={event => handleSubmit(submit)(event)}><Modal.Header closeButton={!busy && !retry}><Modal.Title>Áp dụng lịch đợt học</Modal.Title></Modal.Header><Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      {retry && <Alert variant="warning">Chưa xác định kết quả. Bấm thử lại để gửi đúng lịch vừa xác nhận, tránh tạo thay đổi trùng.</Alert>}
      <p>Chỉ có thể thay đổi các buổi chưa bắt đầu.</p>
      <fieldset disabled={busy || retry}>
        <CourseDateTimeInput control={control} name="plannedStartAt" label="Khai giảng" />
        <p className="text-danger">{errors.plannedStartAt?.message}</p>
        <CourseDateTimeInput control={control} name="plannedEndAt" label="Kết thúc" />
        <p className="text-danger">{errors.plannedEndAt?.message}</p>
        <Form.Label htmlFor="reschedule-units">Số buổi giữ lại</Form.Label><Form.Control id="reschedule-units" type="number" min="1" max={run.totalUnits} {...register('totalUnits')} />
        <p className="text-danger">{errors.totalUnits?.message}</p>
      </fieldset>
    </Modal.Body><Modal.Footer><Button type="submit" disabled={busy}>{retry ? 'Thử lại lịch đã xác nhận' : 'Xác nhận áp dụng toàn bộ lịch'}</Button></Modal.Footer></Form>
  </Modal>;
}
