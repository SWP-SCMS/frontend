import StaffPagination from '../../../components/common/StaffPagination';
import './ManagerCourseWorkflowPage.css';
import CourseWorkflowStatusBadge from '../../../components/common/CourseWorkflowStatusBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useCallback, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Table } from 'react-bootstrap';
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
    </Form.Group>}
    {action === 'verify' && <>
      {[['amountVnd', 'Số tiền đã đối chiếu (VND)', 19], ['disbursementReference', 'Mã tham chiếu khoản chi', 200], ['evidenceReference', 'Tham chiếu chứng từ', 500]].map(([name, label, maxLength]) => <Form.Group key={name} controlId={'course-verify-' + name} className="mb-3">
        <Form.Label>{label}</Form.Label><Form.Control {...register(name)} maxLength={maxLength} inputMode={name === 'amountVnd' ? 'numeric' : undefined} disabled={busy} isInvalid={!!errors[name]} />
        <Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback>
      </Form.Group>)}
    </>}
    {kind === 'refunds' && action === 'approve' && <p>Số tiền đề nghị: <strong>{money(item.grossObligationVnd)}</strong></p>}
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

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, ''); if (!background) commitValue(setData, null);
    const request = kind === 'refunds' ? listCourseRefunds({ page, status })
      : kind === 'withdrawals' ? listCourseWithdrawals() : listCourseTransfers();
    track(request.then((result) => { if (active) commitValue(setData, result); })
      .catch((err) => { failed(err);  if (active) commitError(setError, getCourseErrorMessage(err, 'Không tải được danh sách yêu cầu.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [kind, page, status, revision, busy], !busy);

  const loadDetail = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    const sequence = ++detailSequence.current;
    if (!background) commitValue(setDetail, null); if (!background) commitValue(setContext, null); if (!background) commitValue(setTargets, []); if (!background) commitValue(setAction, ''); commitError(setDetailError, '');
    if (!selectedId) { if (!background) commitValue(setDetailLoading, false); return; }
    if (!background) commitValue(setDetailLoading, true);
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
      commitValue(setDetail, item); commitValue(setContext, { member, run, targetRun });
    } catch (err) { failed(err);
      if (sequence === detailSequence.current) commitError(setDetailError, getCourseErrorMessage(err, 'Không tải được đầy đủ hồ sơ và đợt học. Vui lòng thử lại trước khi quyết định.'));
    } finally { if (sequence === detailSequence.current) if (!background) commitValue(setDetailLoading, false); }
  }, [kind, selectedId]);
  const invalidateDetail = useCallback(() => { detailSequence.current++; }, []);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => { track(loadDetail({ background, commitValue, commitError, failed })); return invalidateDetail; }, [loadDetail, invalidateDetail], !action && !busy);

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

  return <div className="scms-course-workspace">
    <h1 className="h3">Yêu cầu khóa học</h1>
    <nav className="nav nav-tabs scms-request-tabs my-3" aria-label="Loại yêu cầu khóa học">
      {[
        ['withdrawals', 'Rút khóa học'],
        ['transfers', 'Chuyển đợt học'],
        ['refunds', 'Hoàn tiền'],
      ].map(([key, title]) => <Link className={`nav-link${key === kind ? ' active' : ''}`} key={key} to={'/manager/course-' + key} aria-current={key === kind ? 'page' : undefined}>{title}</Link>)}
    </nav>
    <div className="d-flex flex-wrap gap-3 mb-3">
      <Form.Select aria-label="Lọc trạng thái" style={{ maxWidth: 340 }} value={status} disabled={loading || busy} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">Tất cả trạng thái</option>{Object.entries(labels[kind]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Form.Select>
      <Button variant="outline-secondary" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải…</p> : !error && <Card className="border-0 shadow-sm">
      <Table responsive hover className={`mb-0 align-middle ${kind === 'refunds' ? 'course-refund-table' : 'course-request-table'}`}>
        {kind === 'refunds' && <colgroup>
          <col style={{ width: '11%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>}
        {kind !== 'refunds' && <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>}
        <thead className="table-light"><tr>
          <th>Ngày tạo</th>
          <th>Hội viên</th>
          {kind !== 'transfers' && <th>Khóa học / Đợt học</th>}
          {kind === 'withdrawals' && <th>Lý do rút</th>}
          {kind === 'transfers' && <><th>Khóa học / Đợt gốc</th><th>Lý do chuyển</th></>}
          {kind === 'refunds' && <>
            <th>Loại hoàn</th>
            <th className="text-end text-nowrap">Số tiền hoàn</th>
          </>}
          <th>Trạng thái</th>
          <th className="text-end">Thao tác</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id}>
            <td className="text-nowrap">{formatCourseDateTime(row.createdAt || row.requestedAt)}</td>

              <td>
                <strong>{row.memberName || 'Hội viên'}</strong>
                <div className="text-muted small mt-1">{row.memberCode || 'Chưa có mã hội viên'}</div>
              </td>
              <td>
                <div>{row.courseName || row.sourceCourseName || 'Chưa có tên khóa học'}</div>
                <div className="text-muted small mt-1">{row.runCode || row.sourceRunCode || 'Chưa có mã đợt học'}</div>
              </td>
            {kind === 'withdrawals' && <td>{row.requestReason || row.reason || 'Chưa có lý do'}</td>}
            {kind === 'transfers' && <td>{row.requestReason || row.reason || 'Chuyển đợt do thay đổi lịch'}</td>}
            {kind === 'refunds' && <>
              <td>{COURSE_REFUND_SOURCE_LABELS[row.source] || 'Hoàn tiền khóa học'}</td>
              <td className="text-end text-nowrap fw-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {money(row.grossObligationVnd)}
              </td>
            </>}
            <td><CourseWorkflowStatusBadge kind={kind} status={row.status} /></td>
            <td className="text-end text-nowrap">
              <Button size="sm" variant="outline-primary" onClick={() => setParams({ id: row.id })}>Xem hồ sơ</Button>
            </td>
          </tr>)}
          {!rows.length && <tr><td colSpan={kind === 'refunds' ? 7 : 6} className="text-center py-4">Không có yêu cầu phù hợp.</td></tr>}
        </tbody>
      </Table>
    </Card>}
    <StaffPagination page={page} totalPages={totalPages} loading={loading} onPageChange={setPage} />

    <Modal show={!!selectedId} onHide={() => { if (!busy) setParams({}); }} size="lg" centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>{titles[kind]}</Modal.Title></Modal.Header>
      <Modal.Body>
        {detailError && <Alert variant="danger">{detailError}</Alert>}
        <Button size="sm" variant="outline-secondary" className="mb-3" disabled={detailLoading || busy} onClick={loadDetail}>Tải lại hồ sơ</Button>
        {detailLoading ? <p>Đang tải hồ sơ…</p> : detail && context && <>
          <h2 className="h5">{context.member.fullName} · {context.member.memberCode || 'Chưa có mã hội viên'}</h2>
          <p><Link to={'/manager/members/' + detail.memberAccountId}>Hồ sơ hội viên</Link> · <Link to={'/manager/course-runs/' + context.run.id}>{context.run.courseName} · {context.run.runCode}</Link></p>
          {context.targetRun && <p>Đợt học thay thế: <Link to={'/manager/course-runs/' + context.targetRun.id}>{context.targetRun.courseName} · {context.targetRun.runCode}</Link></p>}
          <CourseWorkflowStatusBadge kind={kind} status={detail.status} className="mb-3" />
          {kind === 'refunds' ? <>
            <p>{COURSE_REFUND_SOURCE_LABELS[detail.source] || 'Hoàn tiền khóa học'}</p>
            <dl className="row">{[['grossObligationVnd', 'Nghĩa vụ hoàn'], ['approvedAmountVnd', 'Đã duyệt'], ['disbursedAmountVnd', 'Đã ghi nhận chi'], ['verifiedAmountVnd', 'Đã xác minh']].map(([field, label]) => <div key={field} className="col-sm-6"><dt>{label}</dt><dd>{money(detail[field])}</dd></div>)}</dl>
            {detail.disbursedAt && <Card body className="mb-3"><p>Ghi nhận chi: {formatCourseDateTime(detail.disbursedAt)} · {detail.disbursementMethod === 'CASH' ? 'Tiền mặt' : detail.disbursementMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : '—'}</p><p className="text-break">Tham chiếu: {detail.disbursementReference || '—'}</p><p className="text-break mb-0">Chứng từ: {detail.evidenceReference || '—'}</p></Card>}
            {[['requestReason', 'Lý do đề nghị'], ['approvalReason', 'Lý do duyệt'], ['rejectionReason', 'Lý do từ chối'], ['verificationReason', 'Kết quả xác minh'], ['terminalReason', 'Kết quả xử lý']].map(([field, label]) => detail[field] && <p key={field}><strong>{label}:</strong> {detail[field]}</p>)}
          </> : <>
            <p>Lý do: {detail.requestReason || detail.reason || 'Yêu cầu chuyển đợt học do thay đổi lịch'}</p>
            {detail.decisionReason && <p>Kết quả: {detail.decisionReason}</p>}
            {kind === 'withdrawals' && <p>Số tiền hoàn: <strong>{detail.snapshotSource === 'UNAVAILABLE' ? 'Chưa xác định' : money(detail.refundAmountVnd)}</strong>{detail.remainingUnits != null && <> · {detail.remainingUnits}/{detail.totalUnits} buổi còn lại</>}</p>}
          </>}
          {kind === 'refunds' && courseAmountText(detail.grossObligationVnd) == null && <Alert variant="warning">Số tiền chưa thể hiển thị chính xác. Chưa thể duyệt khoản hoàn này; vui lòng kiểm tra lại hồ sơ.</Alert>}
          <div className="d-flex flex-wrap gap-2">{available.map((value) => <Button key={value} variant={action === value ? 'primary' : 'outline-primary'} disabled={busy || (value === 'verify' && courseAmountText(detail.disbursedAmountVnd) == null) || (kind === 'refunds' && value === 'approve' && courseAmountText(detail.grossObligationVnd) == null)} onClick={() => chooseAction(value)}>{actions[value]}</Button>)}</div>
          {action && <DecisionForm key={detail.id + ':' + detail.version + ':' + action} kind={kind} item={detail} action={action} targets={targets} busy={busy} onSubmit={submit} />}
        </>}
      </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setParams({})}>Đóng</Button></Modal.Footer>
    </Modal>
  </div>;
}
