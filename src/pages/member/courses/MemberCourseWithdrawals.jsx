import Badge from '../../../components/common/SystemBadge';
import useConfirmation from '../../../hooks/useConfirmation';
import usePollingEffect from '../../../hooks/usePollingEffect';
import CancelCourseWithdrawal from './CancelCourseWithdrawal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseWithdrawalSchema } from '../../../schemas/courseSchemas';
import { createMyCourseWithdrawal, listMyCourseWithdrawals } from '../../../services/courseWithdrawalService';
import { formatCourseDateTime, formatCourseMoney, getCourseErrorMessage } from '../../../utils/courseUi';

const STATUS_LABELS = { PENDING: 'Chờ Quản lý duyệt', APPROVED: 'Đã duyệt rút', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy' };

export default function MemberCourseWithdrawals({ enrollments, onRequested, selectedEnrollmentId = '' }) {
  const { confirm, dialog } = useConfirmation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(courseWithdrawalSchema),
    defaultValues: { enrollmentId: '', reason: '' },
  });

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true); if (!background) commitValue(setReady, false); commitError(setError, '');
    try {
      const data = await listMyCourseWithdrawals();
      commitValue(setRequests, data); commitValue(setReady, true);
    } catch (err) { failed(err);
      commitError(setError, getCourseErrorMessage(err, 'Không tải được yêu cầu rút. Vui lòng tải lại trước khi gửi.'));
    } finally { if (!background) commitValue(setLoading, false); }
  }, []);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => { track(load({ background, commitValue, commitError, failed })); }, [load], !busy);

  useEffect(() => { setValue('enrollmentId', selectedEnrollmentId); }, [selectedEnrollmentId, setValue]);

  const pendingIds = new Set(requests.filter((r) => r.status === 'PENDING').map((r) => r.enrollmentId));
  const available = enrollments.filter((e) => e.lifecycleStatus === 'ACTIVE' && !pendingIds.has(e.enrollmentId));
  const enrollmentById = new Map(enrollments.map((e) => [e.enrollmentId, e]));

  async function submit({ enrollmentId, reason }) {
    if (submitting.current || !ready || !available.some((e) => e.enrollmentId === enrollmentId)) return;
    if (!(await confirm('Gửi yêu cầu sẽ tạm ngừng học và điểm danh, vẫn giữ chỗ. Nếu hủy hoặc bị từ chối, các buổi đã lỡ không được học bù. Tiếp tục?'))) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const created = await createMyCourseWithdrawal(enrollmentId, reason);
      setRequests((current) => [created, ...current.filter((r) => r.id !== created.id)]);
      await onRequested(enrollmentId);
      reset();
      setNotice('Đã gửi yêu cầu rút. Bạn giữ chỗ nhưng tạm ngừng học và điểm danh trong thời gian chờ duyệt.');
    } catch (err) {
      // A timeout may have committed on BE. Refresh before allowing another submission.
      await load();
      setError(getCourseErrorMessage(err, 'Chưa xác nhận được kết quả gửi. Kiểm tra lịch sử yêu cầu trước khi thử lại.'));
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="member-course-section" id="withdrawals">{dialog}
    <div className="member-course-section-title">
      <h2>Yêu cầu rút khóa học</h2>
      <Button variant="outline-secondary" disabled={busy || loading} onClick={load}>Tải lại yêu cầu</Button>
    </div>
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    {notice && <Alert variant="success" role="status">{notice}</Alert>}
    {ready && available.length > 0 && <Form noValidate onSubmit={(event) => handleSubmit(submit)(event)} className="member-course-card">
      <Form.Group controlId="course-withdrawal-enrollment" className="mb-3">
        <Form.Label>Đợt học cần rút</Form.Label>
        <Form.Select {...register('enrollmentId')} isInvalid={!!errors.enrollmentId} disabled={busy}>
          <option value="">Chọn đợt học</option>
          {available.map((e) => <option key={e.enrollmentId} value={e.enrollmentId}>{e.courseName} · {e.runCode}</option>)}
        </Form.Select>
        <Form.Control.Feedback type="invalid">{errors.enrollmentId?.message}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group controlId="course-withdrawal-reason" className="mb-3">
        <Form.Label>Lý do xin rút</Form.Label>
        <Form.Control as="textarea" rows={3} maxLength={1000} {...register('reason')} isInvalid={!!errors.reason} disabled={busy} />
        <Form.Control.Feedback type="invalid">{errors.reason?.message}</Form.Control.Feedback>
      </Form.Group>
      <Button type="submit" variant="outline-danger" disabled={busy || loading}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu rút'}</Button>
    </Form>}
    {loading ? <p>Đang tải yêu cầu…</p> : ready && !requests.some(r => !selectedEnrollmentId || r.enrollmentId === selectedEnrollmentId) && <p>Bạn chưa có yêu cầu rút khóa học.</p>}
    {!loading && requests.filter(r => !selectedEnrollmentId || r.enrollmentId === selectedEnrollmentId).map((request) => {
      const enrollment = enrollmentById.get(request.enrollmentId);
      return <article className="member-course-card mt-3" key={request.id}>
        <h3>{enrollment ? `${enrollment.courseName} · ${enrollment.runCode}` : 'Yêu cầu rút khóa học của bạn'}</h3>
        <p><Badge>{STATUS_LABELS[request.status] || 'Đang cập nhật'}</Badge> · Gửi lúc {formatCourseDateTime(request.requestedAt)}</p>
        <p>Lý do xin rút: {request.requestReason}</p>
        {request.decisionReason && <p>Lý do quyết định: {request.decisionReason}</p>}
        {request.decidedAt && <p>Thời điểm quyết định: {formatCourseDateTime(request.decidedAt)}</p>}
        <p>Số tiền hoàn: {request.snapshotSource === 'UNAVAILABLE' || request.refundAmountVnd == null ? 'Chưa xác định' : formatCourseMoney(request.refundAmountVnd)}</p>
        {request.remainingUnits != null && request.totalUnits != null && <p>Số buổi còn lại khi gửi yêu cầu: {request.remainingUnits}/{request.totalUnits}</p>}
        {request.learningSuspended && <p>Tạm ngừng học và điểm danh trong khi chờ xử lý.</p>}
        {request.cancelledAt && <p>Đã hủy lúc {formatCourseDateTime(request.cancelledAt)} · {request.cancellationReason === 'LEGACY_SNAPSHOT_MISSING' ? 'Thiếu thông tin khoản hoàn' : request.cancellationReason === 'COURSE_RUN_CANCELLED' ? 'Đợt học đã hủy' : request.cancellationReason === 'REDUCED_SESSION_COUNT' ? 'Số buổi đã giảm và có khoản hoàn riêng. Vui lòng gửi lại yêu cầu rút theo lịch mới.' : request.cancellationReason}</p>}
        <CancelCourseWithdrawal request={request} onCancelled={async () => { await load(); await onRequested(); }} />
      </article>;
    })}
  </section>;
}
