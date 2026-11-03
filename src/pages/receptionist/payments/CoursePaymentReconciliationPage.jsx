import usePollingEffect from '../../../hooks/usePollingEffect';
import { useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseReconciliationSchema, courseReconciliationSearchSchema } from '../../../schemas/courseReconciliationSchemas';
import { listCourseReconciliationQueue, getCourseReconciliationDetail, getCourseReconciliationResult, reconcileCoursePayment } from '../../../services/courseReconciliationService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { formatCourseMoney as money, formatCourseDateTime as date } from '../../../utils/courseUi';

const statuses = { PENDING: 'Chờ xử lý', PAID: 'Đã thanh toán', FAILED: 'Đã ghi nhận thất bại', EXPIRED: 'Đã hết hạn' };
const blockedLabels = {
  PAYMENT_NOT_PENDING: 'Khoản thanh toán không còn chờ xử lý.',
  PAYMENT_METHOD_NOT_TRANSFER: 'Khoản này không phải thanh toán chuyển khoản.',
  PAYMENT_CURRENCY_MISMATCH: 'Đơn vị tiền tệ không phù hợp.',
  PAYMENT_WINDOW_EXPIRED: 'Đã hết hạn thanh toán, không thể xác nhận đã trả tiền.',
  COURSE_RUN_NOT_PAYABLE: 'Đợt học không còn cho phép thanh toán.',
  DESTINATION_SNAPSHOT_MISSING: 'Thiếu thông tin tài khoản nhận tiền của giao dịch.',
  COURSE_ENROLLMENT_NOT_AVAILABLE: 'Không còn đủ điều kiện ghi danh vào đợt học.',
};
function errorText(error) {
  const code = error?.response?.data?.code || error?.response?.data?.errorCode;
  return ({ PAYMENT_VALIDATION_ERROR: 'Kiểm tra số tiền, nội dung chuyển khoản, mã giao dịch và chứng từ.',
    PAYMENT_FORBIDDEN: 'Bạn không có quyền đối soát khoản thanh toán này.',
    PAYMENT_NOT_FOUND: 'Không tìm thấy khoản thanh toán Course.',
    PAYMENT_CONFLICT: 'Khoản thanh toán đã đổi trạng thái, hết hạn hoặc mã giao dịch đã được sử dụng. Hãy kiểm tra lại kết quả.',
  })[code] || 'Không xác nhận được kết quả. Kiểm tra kết nối và tải lại; nếu thử gửi lại, giữ nguyên thông tin đã gửi.';
}

function Decision({ item, attemptRef, onDone, onBusy }) {
  const [detail, setDetail] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(item.retryAttempt || null);
  const lock = useRef(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver: zodResolver(courseReconciliationSchema),
    defaultValues: attempt ? { ...attempt.payload, receivedAmount: String(attempt.payload.receivedAmount ?? '') } : { status: 'PAID', receivedAmount: '', transferContent: '', providerTransactionId: '', evidence: '', reason: '' },
  });
  const status = useWatch({ control, name: 'status' });
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setDetail, null);
    track(getCourseReconciliationDetail(item.paymentId).then(value => { if (active) commitValue(setDetail, value); })
      .catch(e => { failed(e);  if (active) commitError(setError, errorText(e)); }));
    return () => { active = false; };
  }, [item.paymentId, revision], !busy);
  async function submit(values) {
    if (lock.current || (!attempt && !(status === 'PAID' ? detail?.canConfirmPaid : detail?.canConfirmFailed))) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    const current = attempt || { key: createCourseIdempotencyKey('course-reconcile'), payload: values };
    attemptRef.current[item.paymentId] = current; setAttempt(current);
    try {
      const value = await reconcileCoursePayment(item.paymentId, current.payload, current.key);
      setResult(value); delete attemptRef.current[item.paymentId]; onDone();
    } catch (e) {
      setError(errorText(e));
      if ([400, 409].includes(e?.response?.status)) {
        delete attemptRef.current[item.paymentId]; setAttempt(null); setRevision(v => v + 1);
      }
    }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  async function checkResult() {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try {
      const value = await getCourseReconciliationResult(item.paymentId);
      if (value.status !== 'PENDING') { setResult(value); delete attemptRef.current[item.paymentId]; onDone(); }
      else setRevision(v => v + 1);
    } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <>
    <p><strong>{item.memberName || 'Hội viên'} · {item.memberCode || 'Chưa có mã hội viên'}</strong></p>
    <p>Đơn {item.orderReference || 'khóa học'} · {money(item.amount)} · Hạn {date(item.deadlineAt)}</p>
    {error && <Alert variant="danger">{error}</Alert>}
    <Button variant="outline-secondary" disabled={busy} onClick={checkResult}>Kiểm tra lại kết quả</Button>
    {result ? <Alert className="mt-3" variant={result.status === 'PAID' ? 'success' : 'info'}>
      {statuses[result.status] || 'Đã cập nhật'} · {result.orderReference} · {money(result.amount)}.
      {result.enrollment && <p>Hệ thống đã ghi nhận đăng ký khóa học.</p>}
    </Alert> : <>
      {!detail && !error && <p>Đang tải điều kiện đối soát…</p>}
      {detail && <>
        <p className="mt-3">Tài khoản nhận tiền: {detail.bankCode || '—'} · {detail.bankAccountNumber || '—'} · {detail.bankAccountName || '—'}</p>
        <p>Nội dung cần khớp: <strong>{detail.transferContent || '—'}</strong></p>
        {detail.blockedReason && <Alert variant="warning">{blockedLabels[detail.blockedReason] || 'Chưa đủ điều kiện xác nhận đã thanh toán.'}</Alert>}
      </>}
      {attempt && <Alert variant="info" className="mt-3">Thông tin đã gửi được giữ nguyên để thử lại an toàn. Có thể kiểm tra kết quả trước khi gửi lại.</Alert>}
      <Form noValidate onSubmit={event => { if (attempt) { event.preventDefault(); submit(attempt.payload); } else handleSubmit(submit)(event); }}>
        <fieldset disabled={busy || !!attempt || !detail}>
          <Form.Group controlId="course-reconcile-status" className="my-3"><Form.Label>Kết quả đối soát</Form.Label>
            <Form.Select {...register('status')}><option value="PAID">Xác nhận đã thanh toán</option><option value="FAILED">Ghi nhận thất bại sau hết hạn</option></Form.Select>
          </Form.Group>
          {[...(status === 'PAID' ? [['receivedAmount', 'Số tiền thực nhận (VND)'], ['transferContent', 'Nội dung chuyển khoản thực tế'], ['providerTransactionId', 'Mã giao dịch ngân hàng']] : []), ['evidence', 'Chứng từ đối soát'], ['reason', 'Lý do / kết quả đối chiếu']].map(([name, label]) =>
            <Form.Group key={name} controlId={'course-reconcile-' + name} className="mb-3"><Form.Label>{label}</Form.Label>
              <Form.Control as={['reason', 'evidence'].includes(name) ? 'textarea' : 'input'} inputMode={name === 'receivedAmount' ? 'numeric' : undefined} {...register(name)} isInvalid={!!errors[name]} />
              <Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback>
            </Form.Group>)}
        </fieldset>
        <p>Chỉ xác nhận sau khi đã đối chiếu giao dịch và chứng từ. Đơn hết hạn không được mở lại bằng đối soát.</p>
        <Button type="submit" disabled={busy || (!attempt && !(status === 'PAID' ? detail?.canConfirmPaid : detail?.canConfirmFailed))}>{busy ? 'Đang xử lý…' : attempt ? 'Thử lại quyết định đã gửi' : 'Xác nhận đối soát'}</Button>
      </Form>
    </>}
  </>;
}

export default function CoursePaymentReconciliationPage() {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('ALL'), [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0), [data, setData] = useState(null), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false);
  const attempts = useRef({});
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(courseReconciliationSearchSchema), defaultValues: { query: '' } });
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true; if (!background) commitValue(setData, null); commitError(setError, '');
    track(listCourseReconciliationQueue({ status: filter, query, page, size: 20 }).then(value => { if (active) commitValue(setData, value); })
      .catch(e => { failed(e);  if (active) commitError(setError, errorText(e)); }));
    return () => { active = false; };
  }, [query, filter, page, revision], !busy);
  return <div className="container-fluid py-4">
    <h1 className="h3">Đối soát thanh toán khóa học</h1>
    <p>Các giao dịch chuyển khoản Course đang chờ xử lý. Giao dịch đã xử lý sẽ rời danh sách.</p>
    <Form noValidate onSubmit={handleSubmit(values => { setQuery(values.query); setPage(0); setRevision(v => v + 1); })} className="d-flex gap-2 mb-3">
      <div className="flex-grow-1"><Form.Control aria-label="Tìm đơn hoặc hội viên" placeholder="Mã đơn, nội dung chuyển khoản, tên hoặc mã hội viên" {...register('query')} isInvalid={!!errors.query} />
        <Form.Control.Feedback type="invalid">{errors.query?.message}</Form.Control.Feedback></div><Button type="submit">Tìm kiếm</Button>
    </Form>
    <Form.Select aria-label="Hạn thanh toán" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} className="mb-3">
      <option value="ALL">Tất cả giao dịch chờ xử lý</option><option value="PENDING">Còn trong hạn</option><option value="EXPIRED_WINDOW">Quá hạn, chưa được xử lý</option>
    </Form.Select>
    <Button onClick={() => setRevision(v => v + 1)}>Tải lại danh sách</Button>
    {error && <Alert className="mt-3" variant="danger">{error}</Alert>}
    {!data && !error && <p>Đang tải…</p>}
    {data && <><Table responsive className="mt-3"><thead><tr><th>Hội viên</th><th>Đơn / nội dung chuyển khoản</th><th>Số tiền</th><th>Hạn thanh toán</th><th /></tr></thead><tbody>
      {data.content.map(item => <tr key={item.paymentId}><td>{item.memberName || 'Hội viên'}<br />{item.memberCode || 'Chưa có mã hội viên'}</td><td>{item.orderReference}<br />{item.paymentReference}</td><td>{money(item.amount)}</td><td>{date(item.deadlineAt)}</td><td><Button onClick={() => setSelected({ ...item, retryAttempt: attempts.current[item.paymentId] })}>Đối soát</Button></td></tr>)}
      {!data.content.length && <tr><td colSpan={5}>Không có giao dịch chờ đối soát phù hợp.</td></tr>}
    </tbody></Table><Button disabled={!page} onClick={() => setPage(v => v - 1)}>Trang trước</Button><span className="mx-3">Trang {page + 1}</span><Button disabled={page + 1 >= data.totalPages} onClick={() => setPage(v => v + 1)}>Trang sau</Button></>}
    <Modal show={!!selected} onHide={() => { if (!busy) setSelected(null); }} backdrop={busy ? 'static' : true} keyboard={!busy} size="lg">
      <Modal.Header closeButton={!busy}><Modal.Title>Đối soát Course</Modal.Title></Modal.Header>
      <Modal.Body>{selected && <Decision key={selected.paymentId} item={selected} attemptRef={attempts} onBusy={setBusy} onDone={() => setRevision(v => v + 1)} />}</Modal.Body>
    </Modal>
  </div>;
}
