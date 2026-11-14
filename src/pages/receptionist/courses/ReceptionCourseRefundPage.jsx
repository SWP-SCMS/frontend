import StaffPagination from '../../../components/common/StaffPagination';
import Badge from '../../../components/common/SystemBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseDisbursementSchema } from '../../../schemas/courseWorkflowSchemas';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { courseAmountText } from '../../../utils/courseWorkflow';
import { disburseCourseRefund } from '../../../services/courseWorkflowService';
import { useRef, useState } from 'react';
import {Alert,  Button, Card, Form, Modal, Table} from 'react-bootstrap';
import { listReceptionCourseRefunds, getReceptionCourseRefund } from '../../../services/courseWorkflowService';
import { COURSE_ELIGIBILITY_LABELS, COURSE_REFUND_SOURCE_LABELS } from '../../../utils/courseWorkflow';
import { COURSE_RUN_STATUS_LABELS, formatCourseDateTime, formatCourseMoney, getCourseErrorMessage } from '../../../utils/courseUi';

function RefundSummary({ item }) {
  return <>
    <h2 className="h5">{item.memberName || 'Hội viên'} · {item.memberCode || 'Chưa có mã hội viên'}</h2>
    <p>{item.courseName || 'Khóa học'} · {item.courseCode || '—'} · {item.runCode || 'Đợt học'}</p>
    <p>Trạng thái đợt học: <Badge>{COURSE_RUN_STATUS_LABELS[item.courseRunStatus] || 'Chưa có thông tin'}</Badge></p>
    <p>{COURSE_REFUND_SOURCE_LABELS[item.source] || 'Hoàn tiền khóa học'}</p>
    <p>Số tiền đã duyệt: <strong>{formatCourseMoney(item.amount)}</strong></p>
    <p>Ngày duyệt: {formatCourseDateTime(item.approvedAt)}</p>
    <Badge bg={item.disbursementEligible ? 'success' : 'warning'} text={item.disbursementEligible ? 'light' : 'dark'}>{COURSE_ELIGIBILITY_LABELS[item.disbursementEligibilityReason] || 'Chưa xác định điều kiện chi'}</Badge>
  </>;
}

function DisbursementForm({ item, onDone, onBusy }) {
  const lock = useRef(false);
  const [attempt, setAttempt] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(courseDisbursementSchema), defaultValues: { method: 'CASH', reference: '', evidenceReference: '', confirmed: false } });
  const valid = item.disbursementEligible && Number.isSafeInteger(item.version) && item.version >= 0 && courseAmountText(item.amount) !== null;
  async function submit(values) {
    if (lock.current || !valid) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    // Freeze the payload with its key: a retry must repeat the same operation.
    const currentAttempt = attempt || { key: createCourseIdempotencyKey('course-refund'), payload: { expectedVersion: item.version, amountVnd: courseAmountText(item.amount), method: values.method, reference: values.reference, evidenceReference: values.evidenceReference } };
    setAttempt(currentAttempt);
    setAttempted(true);
    try {
      await disburseCourseRefund(item.refundId, currentAttempt.payload, currentAttempt.key);
      onDone();
    } catch (err) { setError(getCourseErrorMessage(err, 'Chưa xác nhận được khoản chi. Thử lại giữ nguyên thông tin hoặc tải lại hồ sơ để kiểm tra.')); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  if (!valid) return <Alert variant="warning" className="mt-3">Khoản này chưa đủ điều kiện hoặc thiếu dữ liệu để ghi nhận chi.</Alert>;
  return <Form noValidate onSubmit={(event) => handleSubmit(submit)(event)} className="mt-3">
    {error && <Alert variant="danger">{error}</Alert>}
    <fieldset disabled={busy || attempted}>
      <Form.Group controlId="refund-method"><Form.Label>Phương thức đã chi</Form.Label><Form.Select {...register('method')}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></Form.Select></Form.Group>
      {[['reference', 'Mã tham chiếu khoản chi'], ['evidenceReference', 'Tham chiếu chứng từ']].map(([name, label]) => <Form.Group className="mt-3" controlId={'refund-' + name} key={name}><Form.Label>{label}</Form.Label><Form.Control {...register(name)} isInvalid={!!errors[name]} /><Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback></Form.Group>)}
      <Form.Check className="my-3" id="refund-confirmed" label={`Tôi xác nhận đã chi ${formatCourseMoney(item.amount)} cho hội viên nêu trên và đã đối chiếu chứng từ.`} {...register('confirmed')} isInvalid={!!errors.confirmed} feedback={errors.confirmed?.message} feedbackType="invalid" />
    </fieldset>
    <Button type="submit" disabled={busy}>{busy ? 'Đang ghi nhận…' : attempted ? 'Thử lại khoản chi này' : 'Ghi nhận đã chi'}</Button>
  </Form>;
}

export default function ReceptionCourseRefundPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [eligible, setEligible] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, ''); if (!background) commitValue(setData, null);
    track(listReceptionCourseRefunds({ page, eligible: eligible === '' ? undefined : eligible === 'true', query })
      .then((result) => { if (active) commitValue(setData, result); })
      .catch((err) => { failed(err);  if (active) commitError(setError, getCourseErrorMessage(err, 'Không tải được hàng chờ hoàn tiền khóa học.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [page, eligible, query, revision], !busy);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setDetail, null); commitError(setDetailError, ''); if (!background) commitValue(setDetailLoading, !!selectedId);
    if (selectedId) track(getReceptionCourseRefund(selectedId)
      .then((result) => { if (active) commitValue(setDetail, result); })
      .catch((err) => { failed(err);  if (active) commitError(setDetailError, getCourseErrorMessage(err, 'Không tải được khoản hoàn. Khoản này có thể đã được xử lý và rời hàng chờ.')); })
      .finally(() => { if (active) if (!background) commitValue(setDetailLoading, false); }));
    return () => { active = false; };
  }, [selectedId, detailRevision], !busy);
  return <div className="scms-course-workspace">
    <h1 className="h3">Hoàn tiền khóa học</h1>
    {notice && <Alert variant="success">{notice}</Alert>}
    <div className="d-flex flex-wrap gap-3 mb-3">
      <Form role="search" className="d-flex flex-wrap gap-2" style={{ flex: '1 1 360px', maxWidth: 620 }} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(0); setRevision(value => value + 1); }}>
        <Form.Label htmlFor="reception-refund-member-search" className="visually-hidden">Tên, mã hoặc số điện thoại hội viên</Form.Label>
        <Form.Control id="reception-refund-member-search" type="search" value={search} maxLength={100} disabled={busy} style={{ flex: '1 1 200px', minWidth: 0 }} placeholder="Tên, mã hoặc số điện thoại hội viên, ví dụ MB-100082" onChange={event => setSearch(event.target.value)} />
        <Button type="submit" disabled={loading || busy}>Tìm</Button>
        {(query || search) && <Button variant="outline-secondary" disabled={busy} onClick={() => { setSearch(''); setQuery(''); setPage(0); }}>Xóa tìm kiếm</Button>}
      </Form>
      <Form.Select aria-label="Điều kiện chi" style={{ maxWidth: 320 }} value={eligible} disabled={loading} onChange={(event) => { setEligible(event.target.value); setPage(0); }}><option value="">Tất cả khoản đã duyệt</option><option value="true">Đủ điều kiện chi</option><option value="false">Chưa đủ điều kiện chi</option></Form.Select>
      <Button variant="outline-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải hàng chờ…</p> : data && <Card className="border-0 shadow-sm"><Table responsive hover className="scms-course-refund-table mb-0 align-middle"><thead className="table-light"><tr><th>Hội viên</th><th>Khóa học / đợt</th><th className="text-end">Số tiền đã duyệt</th><th>Điều kiện chi</th><th className="text-end">Thao tác</th></tr></thead><tbody>
      {data.items.map((item) => <tr key={item.refundId}><td>{item.memberName || 'Hội viên'}<br /><small>{item.memberCode || 'Chưa có mã hội viên'}</small></td><td>{item.courseName || 'Khóa học'}<br /><small>{item.runCode || 'Đợt học'}</small></td><td className="text-end text-nowrap fw-semibold">{formatCourseMoney(item.amount)}</td><td><Badge tone={item.disbursementEligibilityReason === 'ELIGIBLE' ? 'green' : item.disbursementEligibilityReason === 'AWAITING_COURSE_COMPLETION' ? 'amber' : 'neutral'}>{COURSE_ELIGIBILITY_LABELS[item.disbursementEligibilityReason] || 'Chưa xác định'}</Badge></td><td className="text-end text-nowrap"><Button size="sm" variant="outline-primary" onClick={() => setSelectedId(item.refundId)}>Chi tiết</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={5} className="text-center py-4">Không có khoản hoàn phù hợp.</td></tr>}
    </tbody></Table>
    <StaffPagination page={page} totalPages={data?.totalPages} totalElements={data?.totalElements} loading={loading || !data} onPageChange={setPage} /></Card>}
    <Modal show={!!selectedId} onHide={() => { if (!busy) setSelectedId(''); }} centered backdrop={busy ? 'static' : true} keyboard={!busy}><Modal.Header closeButton={!busy}><Modal.Title>Khoản hoàn đã duyệt</Modal.Title></Modal.Header><Modal.Body>
      {detailError && <Alert variant="danger">{detailError}</Alert>}
      {detailLoading ? <p>Đang tải…</p> : detail && <><RefundSummary item={detail} /><DisbursementForm key={detail.refundId + ":" + detailRevision} item={detail} onBusy={setBusy} onDone={() => { setSelectedId(''); setRevision((value) => value + 1); setNotice('Đã ghi nhận chi, chờ Quản lý xác minh.'); }} /></>}
    </Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={detailLoading || busy} onClick={() => setDetailRevision((value) => value + 1)}>Tải lại</Button><Button variant="secondary" disabled={busy} onClick={() => setSelectedId('')}>Đóng</Button></Modal.Footer></Modal>
  </div>;
}
