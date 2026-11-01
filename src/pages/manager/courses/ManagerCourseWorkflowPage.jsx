import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  listCourseWithdrawals, getCourseWithdrawal, decideCourseWithdrawal,
  listCourseTransfers, listCourseTransferTargets, decideCourseTransfer,
  listCourseRefunds, getCourseRefund, decideCourseRefund,
} from '../../../services/courseWorkflowService';
import { courseDecisionSchema, courseTransferDecisionSchema, courseVerificationSchema } from '../../../schemas/courseWorkflowSchemas';
import { formatCourseDateTime, formatCourseMoney, getCourseErrorMessage } from '../../../utils/courseUi';
import {
  COURSE_REFUND_STATUS_LABELS, COURSE_REFUND_SOURCE_LABELS, COURSE_TRANSFER_REQUEST_STATUS_LABELS,
  COURSE_WITHDRAWAL_STATUS_LABELS, courseRefundActions, courseAmountText,
} from '../../../utils/courseWorkflow';

const labels = { refunds: COURSE_REFUND_STATUS_LABELS, withdrawals: COURSE_WITHDRAWAL_STATUS_LABELS, transfers: COURSE_TRANSFER_REQUEST_STATUS_LABELS };
const titles = { refunds: 'Hoàn tiền khóa học', withdrawals: 'Yêu cầu rút khóa học', transfers: 'Yêu cầu chuyển đợt học' };
const actions = { approve: 'Duyệt', reject: 'Từ chối', verify: 'Xác minh hoàn tất', fail: 'Ghi nhận thất bại', return: 'Ghi nhận tiền trả lại' };
const money = (value) => value == null ? 'Chưa xác định' : formatCourseMoney(value);

function DecisionForm({ kind, item, action, targets, onSubmit, busy }) {
  const schema = action === 'verify' ? courseVerificationSchema
    : kind === 'transfers' && action === 'approve' ? courseTransferDecisionSchema : courseDecisionSchema;
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reason: '', targetRunId: '', amountVnd: '', disbursementReference: '', evidenceReference: '' },
  });
  return <Form noValidate onSubmit={handleSubmit(onSubmit)} className="border-top pt-3 mt-3">
    <h3 className="h6">{actions[action]}</h3>
    {kind === 'transfers' && action === 'approve' && <Form.Group controlId="course-decision-target" className="mb-3">
      <Form.Label>Đợt học thay thế</Form.Label>
      <Form.Select {...register('targetRunId')} disabled={busy} isInvalid={!!errors.targetRunId}>
        <option value="">Chọn đợt học</option>
        {targets.map((target) => <option key={target.runId} value={target.runId}>{target.courseName} · {target.runCode} · {formatCourseMoney(target.tuitionVnd)} · {target.capacity - target.usedSeats} chỗ trống</option>)}
      </Form.Select>
      <Form.Control.Feedback type="invalid">{errors.targetRunId?.message}</Form.Control.Feedback>
      {!targets.length && <p className="text-muted mt-2">Chưa có đợt học thay thế khả dụng.</p>}
      <p className="text-muted mt-2">Hệ thống kiểm tra lại chỗ trống và trùng lịch khi duyệt. Hội viên cần chấp nhận đề nghị trước khi chuyển.</p>
    </Form.Group>}
    {action === 'verify' && <>
      <Alert variant="info">Đối chiếu khoản chi và chứng từ, sau đó nhập lại số tiền và các mã tham chiếu để xác minh.</Alert>
      {[['amountVnd', 'Số tiền đã đối chiếu (VND)', 19], ['disbursementReference', 'Mã tham chiếu khoản chi', 200], ['evidenceReference', 'Tham chiếu chứng từ', 500]].map(([name, label, maxLength]) => <Form.Group key={name} controlId={'course-verify-' + name} className="mb-3">
        <Form.Label>{label}</Form.Label><Form.Control {...register(name)} maxLength={maxLength} inputMode={name === 'amountVnd' ? 'numeric' : undefined} disabled={busy} isInvalid={!!errors[name]} />
        <Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback>
      </Form.Group>)}
    </>}
    {kind === 'refunds' && action === 'approve' && <p>Số tiền đề nghị: <strong>{money(item.grossObligationVnd)}</strong>. Duyệt khoản hoàn chưa phải xác nhận đã chi.</p>}
    {kind === 'withdrawals' && action === 'approve' && <p>Hệ thống xác định số buổi còn lại và số tiền hoàn tại thời điểm duyệt. Khoản hoàn được xử lý riêng.</p>}
    <Form.Group controlId="course-decision-reason" className="mb-3">
      <Form.Label>Lý do / kết quả đối chiếu</Form.Label>
      <Form.Control as="textarea" rows={3} {...register('reason')} maxLength={1000} disabled={busy} isInvalid={!!errors.reason} />
      <Form.Control.Feedback type="invalid">{errors.reason?.message}</Form.Control.Feedback>
    </Form.Group>
    <Button type="submit" variant="danger" disabled={busy || (kind === 'transfers' && action === 'approve' && !targets.length)}>{busy ? 'Đang xử lý…' : 'Xác nhận ' + actions[action].toLowerCase()}</Button>
  </Form>;
}

export default function ManagerCourseWorkflowPage({ kind = 'refunds' }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [context, setContext] = useState(null);
  const [targets, setTargets] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const detailSequence = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    const request = kind === 'refunds' ? listCourseRefunds({ page, status })
      : kind === 'withdrawals' ? listCourseWithdrawals() : listCourseTransfers();
    request.then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getCourseErrorMessage(err, 'Không tải được danh sách yêu cầu.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, page, status, revision]);

  const loadDetail = useCallback(async () => {
    const sequence = ++detailSequence.current;
    setDetail(null); setContext(null); setTargets([]); setAction(''); setDetailError('');
    if (!selectedId) { setDetailLoading(false); return; }
    setDetailLoading(true);
    try {
      // Fetch identities only for the opened request; never one request per queue row.
      const item = kind === 'refunds' ? await getCourseRefund(selectedId)
        : kind === 'withdrawals' ? await getCourseWithdrawal(selectedId)
          : (await listCourseTransfers()).find((entry) => entry.id === selectedId);
      if (!item) throw new Error('Request unavailable');
      const member = { fullName: item.memberName || 'Hội viên', memberCode: item.memberCode };
      const run = { id: item.courseRunId || item.sourceRunId, courseName: item.courseName || item.sourceCourseName, runCode: item.runCode || item.sourceRunCode };
      const targetRun = item.targetRunId ? { id: item.targetRunId, courseName: item.targetCourseName, runCode: item.targetRunCode } : null;
      if (sequence !== detailSequence.current) return;
      setDetail(item); setContext({ member, run, targetRun });
    } catch (err) {
      if (sequence === detailSequence.current) setDetailError(getCourseErrorMessage(err, 'Không tải được đầy đủ hồ sơ và đợt học. Vui lòng thử lại trước khi quyết định.'));
    } finally { if (sequence === detailSequence.current) setDetailLoading(false); }
  }, [kind, selectedId]);
  const invalidateDetail = useCallback(() => { detailSequence.current++; }, []);
  useEffect(() => { loadDetail(); return invalidateDetail; }, [loadDetail, invalidateDetail]);

  async function chooseAction(next) {
    if (mutationLock.current) return;
    setDetailError('');
    if (kind === 'transfers' && next === 'approve') {
      mutationLock.current = true; setBusy(true);
      try { setTargets(await listCourseTransferTargets(detail.id)); setAction(next); }
      catch (err) { setDetailError(getCourseErrorMessage(err, 'Không tải được các đợt học thay thế.')); }
      finally { mutationLock.current = false; setBusy(false); }
    } else setAction(next);
  }

  async function submit(values) {
    if (mutationLock.current || !detail || !context) return;
    if (kind === 'refunds' && (!Number.isSafeInteger(detail.version) || detail.version < 0)) {
      setDetailError('Hồ sơ chưa đủ thông tin để xử lý. Vui lòng tải lại.'); return;
    }
    mutationLock.current = true; setBusy(true); setDetailError(''); setNotice('');
    try {
      if (kind === 'refunds') {
        await decideCourseRefund(detail.id, action, { ...values, expectedVersion: detail.version });
      } else if (kind === 'withdrawals') {
        await decideCourseWithdrawal(detail.id, action, values.reason);
      } else {
        await decideCourseTransfer(detail.id, action, values);
      }
      setNotice(kind === 'transfers' && action === 'approve' ? 'Đã gửi đề nghị chuyển đợt học cho hội viên.' : 'Đã cập nhật hồ sơ.');
      setRevision((value) => value + 1);
      await loadDetail();
    } catch (err) {
      setDetailError(getCourseErrorMessage(err, 'Chưa xác nhận được kết quả xử lý. Tải lại hồ sơ để kiểm tra trước khi gửi tiếp.'));
    } finally { mutationLock.current = false; setBusy(false); }
  }

  const allRows = kind === 'refunds' ? data?.items || [] : Array.isArray(data) ? data : [];
  const filtered = kind === 'refunds' || !status ? allRows : allRows.filter((row) => row.status === status);
  const totalPages = kind === 'refunds' ? data?.totalPages || 0 : Math.ceil(filtered.length / 20);
  const rows = kind === 'refunds' ? filtered : filtered.slice(page * 20, (page + 1) * 20);
  const available = !detail ? [] : kind === 'refunds' ? courseRefundActions(detail.status) : detail.status === 'PENDING' ? ['approve', 'reject'] : [];

  return <div className="container-fluid py-4">
    <h1 className="h3">{titles[kind]}</h1>
    <nav className="d-flex flex-wrap gap-3 my-3" aria-label="Xử lý khóa học">{Object.entries(titles).map(([key, title]) => <Link key={key} to={'/manager/course-' + key} aria-current={key === kind ? 'page' : undefined}>{title}</Link>)}</nav>
    <p>Mở hồ sơ để xem hội viên và đợt học trước khi xử lý.</p>
    <div className="d-flex flex-wrap gap-3 mb-3">
      <Form.Select aria-label="Lọc trạng thái" style={{ maxWidth: 340 }} value={status} disabled={loading || busy} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">Tất cả trạng thái</option>{Object.entries(labels[kind]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Form.Select>
      <Button variant="outline-secondary" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải…</p> : !error && <Card><Table responsive hover className="mb-0 align-middle"><thead><tr><th>Ngày tạo</th><th>Nội dung</th><th>Trạng thái</th><th /></tr></thead><tbody>
      {rows.map((row) => <tr key={row.id}><td>{formatCourseDateTime(row.createdAt || row.requestedAt)}</td><td>{kind === 'refunds' ? <>{COURSE_REFUND_SOURCE_LABELS[row.source] || 'Hoàn tiền khóa học'}<br />{money(row.grossObligationVnd)}</> : row.requestReason || row.reason || 'Chuyển đợt do thay đổi lịch'}</td><td>{labels[kind][row.status] || 'Đang cập nhật'}</td><td><Button size="sm" variant="outline-primary" onClick={() => setParams({ id: row.id })}>Xem hồ sơ</Button></td></tr>)}
      {!rows.length && <tr><td colSpan={4} className="text-center py-4">Không có yêu cầu phù hợp.</td></tr>}
    </tbody></Table></Card>}
    <div className="d-flex gap-3 align-items-center mt-3"><Button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {page + 1}</span><Button disabled={loading || page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button></div>

    <Modal show={!!selectedId} onHide={() => { if (!busy) setParams({}); }} size="lg" centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>{titles[kind]}</Modal.Title></Modal.Header>
      <Modal.Body>
        {detailError && <Alert variant="danger">{detailError}</Alert>}
        <Button size="sm" variant="outline-secondary" className="mb-3" disabled={detailLoading || busy} onClick={loadDetail}>Tải lại hồ sơ</Button>
        {detailLoading ? <p>Đang tải hồ sơ…</p> : detail && context && <>
          <h2 className="h5">{context.member.fullName} · {context.member.memberCode || 'Chưa có mã hội viên'}</h2>
          <p><Link to={'/manager/members/' + detail.memberAccountId}>Hồ sơ hội viên</Link> · <Link to={'/manager/course-runs/' + context.run.id}>{context.run.courseName} · {context.run.runCode}</Link></p>
          {context.targetRun && <p>Đợt học thay thế: <Link to={'/manager/course-runs/' + context.targetRun.id}>{context.targetRun.courseName} · {context.targetRun.runCode}</Link></p>}
          <Badge bg="secondary" className="mb-3">{labels[kind][detail.status] || 'Đang cập nhật'}</Badge>
          {kind === 'refunds' ? <>
            <p>{COURSE_REFUND_SOURCE_LABELS[detail.source] || 'Hoàn tiền khóa học'}</p>
            <dl className="row">{[['grossObligationVnd', 'Nghĩa vụ hoàn'], ['approvedAmountVnd', 'Đã duyệt'], ['disbursedAmountVnd', 'Đã ghi nhận chi'], ['verifiedAmountVnd', 'Đã xác minh']].map(([field, label]) => <div key={field} className="col-sm-6"><dt>{label}</dt><dd>{money(detail[field])}</dd></div>)}</dl>
            {detail.disbursedAt && <Card body className="mb-3"><p>Ghi nhận chi: {formatCourseDateTime(detail.disbursedAt)} · {detail.disbursementMethod === 'CASH' ? 'Tiền mặt' : detail.disbursementMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : '—'}</p><p className="text-break">Tham chiếu: {detail.disbursementReference || '—'}</p><p className="text-break mb-0">Chứng từ: {detail.evidenceReference || '—'}</p></Card>}
            {[['requestReason', 'Lý do đề nghị'], ['approvalReason', 'Lý do duyệt'], ['rejectionReason', 'Lý do từ chối'], ['verificationReason', 'Kết quả xác minh'], ['terminalReason', 'Kết quả xử lý']].map(([field, label]) => detail[field] && <p key={field}><strong>{label}:</strong> {detail[field]}</p>)}
          </> : <>
            <p>Lý do: {detail.requestReason || detail.reason || 'Yêu cầu chuyển đợt học do thay đổi lịch'}</p>
            {detail.decisionReason && <p>Kết quả: {detail.decisionReason}</p>}
            {kind === 'withdrawals' && <p>Số tiền hoàn được xác định: <strong>{money(detail.refundAmountVnd)}</strong>{detail.remainingUnits != null && <> · {detail.remainingUnits}/{detail.totalUnits} buổi còn lại</>}</p>}
          </>}
          {kind === 'refunds' && courseAmountText(detail.grossObligationVnd) == null && <Alert variant="warning">Số tiền chưa thể hiển thị chính xác. Chưa thể duyệt khoản hoàn này; vui lòng kiểm tra lại hồ sơ.</Alert>}
          <div className="d-flex flex-wrap gap-2">{available.map((value) => <Button key={value} variant={action === value ? 'primary' : 'outline-primary'} disabled={busy || (value === 'verify' && courseAmountText(detail.disbursedAmountVnd) == null) || (kind === 'refunds' && value === 'approve' && courseAmountText(detail.grossObligationVnd) == null)} onClick={() => chooseAction(value)}>{actions[value]}</Button>)}</div>
          {action && <DecisionForm key={detail.id + ':' + detail.version + ':' + action} kind={kind} item={detail} action={action} targets={targets} busy={busy} onSubmit={submit} />}
        </>}
      </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setParams({})}>Đóng</Button></Modal.Footer>
    </Modal>
  </div>;
}
