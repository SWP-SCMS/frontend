import CourseWorkflowStatusBadge from '../../../components/common/CourseWorkflowStatusBadge';
import './MemberCourseWithdrawals.css';
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


export default function MemberCourseWithdrawals({ enrollments, onRequested, selectedEnrollmentId = '' }) {
  const { confirm, dialog } = useConfirmation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
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

  return <section className="course-withdrawals" id="withdrawals">{dialog}
    <div className="course-withdrawals-toolbar">
      <h2>Yêu cầu rút khóa học</h2>
      <Button size="sm" variant="outline-secondary" disabled={busy || loading} onClick={load}>Tải lại yêu cầu</Button>
    </div>
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    {notice && <Alert variant="success" role="status">{notice}</Alert>}
    {ready && available.length > 0 && <Form noValidate onSubmit={(event) => handleSubmit(submit)(event)} className="course-withdrawal-form">
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
      <Button type="submit" variant="danger" disabled={busy || loading}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu rút'}</Button>
    </Form>}
    {loading ? <p>Đang tải yêu cầu…</p> : ready && !requests.some(r => !selectedEnrollmentId || r.enrollmentId === selectedEnrollmentId) && <p>Bạn chưa có yêu cầu rút khóa học.</p>}
    {!loading && requests.filter(r => !selectedEnrollmentId || r.enrollmentId === selectedEnrollmentId).map((request) => {
      const enrollment = enrollmentById.get(request.enrollmentId);
      const reason = request.requestReason === 'Withdrawal requested after a material schedule change'
        ? 'Trung tâm thay đổi lịch học.' : request.requestReason || 'Chưa có lý do.';
      const runCode = enrollment?.runCode || request.runCode;
      return <article className="course-withdrawal-card" key={request.id}>
        <header className="course-withdrawal-header">
          <div><h3>{enrollment?.courseName || request.courseName || 'Yêu cầu rút khóa học của bạn'}</h3>
            {runCode && <span className="course-withdrawal-run">Đợt học: {runCode}</span>}
          </div>
          <CourseWorkflowStatusBadge kind="withdrawals" status={request.status} refundStatus={request.refundStatus} />
        </header>
        <div className="course-withdrawal-body">
          <dl className="course-withdrawal-details">
            <div><dt>Lý do rút khóa học</dt><dd>{reason}</dd></div>
            <div><dt>Ngày gửi yêu cầu</dt><dd>{formatCourseDateTime(request.requestedAt)}</dd></div>
            {request.decisionReason && <div><dt>Ý kiến của quản lý</dt><dd>{request.decisionReason}</dd></div>}
            {request.decidedAt && <div><dt>Ngày xử lý</dt><dd>{formatCourseDateTime(request.decidedAt)}</dd></div>}
            {request.cancelledAt && <div><dt>Đã hủy yêu cầu</dt><dd>{formatCourseDateTime(request.cancelledAt)}<br />{request.cancellationReason === 'LEGACY_SNAPSHOT_MISSING' ? 'Thiếu thông tin khoản hoàn' : request.cancellationReason === 'COURSE_RUN_CANCELLED' ? 'Đợt học đã hủy' : request.cancellationReason === 'REDUCED_SESSION_COUNT' ? 'Số buổi đã giảm và có khoản hoàn riêng. Vui lòng gửi lại yêu cầu rút theo lịch mới.' : request.cancellationReason}</dd></div>}
          </dl>
          <aside className="course-withdrawal-refund">
            <span>{request.status === 'PENDING' ? 'Hoàn tiền dự kiến' : 'Khoản hoàn theo yêu cầu'}</span>
            <strong>{request.snapshotSource === 'UNAVAILABLE' || request.refundAmountVnd == null ? 'Chưa xác định' : formatCourseMoney(request.refundAmountVnd)}</strong>
            {request.remainingUnits != null && request.totalUnits != null && <div className="course-withdrawal-units"><span>Buổi còn lại khi gửi</span><b>{request.remainingUnits}/{request.totalUnits} buổi</b></div>}
            {request.status === 'PENDING' && <small>Khoản hoàn được xử lý sau khi yêu cầu được duyệt.</small>}
          </aside>
        </div>
        {(request.learningSuspended || request.canCancel) && <footer className="course-withdrawal-footer">
          {request.learningSuspended && <p>Đang chờ quản lý duyệt. Bạn tạm ngừng học và điểm danh; chỗ học vẫn được giữ.</p>}
          <CancelCourseWithdrawal variant="outline-danger" request={request} onCancelled={async () => { await load(); await onRequested(); }} />
        </footer>}
      </article>;
    })}
  </section>;
}
