import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { courseDecisionSchema } from '../../../schemas/courseWorkflowSchemas';
import api from '../../../services/api';
import { getCourseErrorMessage } from '../../../utils/courseUi';

export default function CancelCourseWithdrawal({ request, memberId, onCancelled }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(courseDecisionSchema), defaultValues: { reason: '' } });
  async function submit(values) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const base = memberId ? `/reception/members/${memberId}` : '/members/me';
      await api.post(`${base}/course-withdrawal-requests/${request.id}/cancel`, values);
      setOpen(false); await onCancelled();
    } catch (e) { setError(getCourseErrorMessage(e, 'Không hủy được yêu cầu. Tải lại để kiểm tra trạng thái.')); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!request.canCancel) return null;
  return <><Button onClick={() => { reset({ reason: '' }); setError(''); setOpen(true); }}>Hủy yêu cầu rút</Button>
    <Modal show={open} onHide={() => { if (!busy) setOpen(false); }} backdrop="static"><Form noValidate onSubmit={e => handleSubmit(submit)(e)}>
      <Modal.Header closeButton={!busy}><Modal.Title>Hủy yêu cầu rút</Modal.Title></Modal.Header><Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>Khôi phục quyền học sau khi hủy thành công. Không học bù những buổi đã lỡ trong thời gian chờ.</p>
        <Form.Label htmlFor="cancel-withdrawal-reason">Lý do hủy</Form.Label>
        <Form.Control id="cancel-withdrawal-reason" as="textarea" disabled={busy} {...register('reason')} />
        <p className="text-danger">{errors.reason?.message}</p>
      </Modal.Body><Modal.Footer><Button type="submit" disabled={busy}>Xác nhận hủy yêu cầu</Button></Modal.Footer>
    </Form></Modal></>;
}
