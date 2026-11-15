import usePollingEffect from '../../../hooks/usePollingEffect';
import ReceptionCourseActions from './ReceptionCourseActions';
import CourseMemberLookup from './CourseMemberLookup';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseMemberSearchSchema } from '../../../schemas/courseSchemas';
import { normalizePhone } from '../../../utils';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { searchReceptionMember } from '../../../services/receptionistService';
import { getCatalogCourseRun, listAllCatalogCourseRuns } from '../../../services/courseCatalogService';
import { createReceptionCourseOrder, getReceptionCourseOrder, startReceptionCourseSepayPayment, confirmReceptionCourseCashPayment } from '../../../services/courseOrderService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { COURSE_ORDER_STATUS_LABELS, formatCourseMoney, formatCourseDateTime, getCourseStatusLabel, getCourseErrorMessage } from '../../../utils/courseUi';

export default function ReceptionCourseBookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOrderId = searchParams.get('orderId');
  const requestedMemberCode = searchParams.get('memberCode');
  const [resuming, setResuming] = useState(!!requestedOrderId);
  const [resumeRevision, setResumeRevision] = useState(0);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [memberRevision, setMemberRevision] = useState(0);
  const refreshMemberPanels = () => setMemberRevision(value => value + 1);
  const [showCashConfirmation, setShowCashConfirmation] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(courseMemberSearchSchema), defaultValues: { kind: 'memberId', query: '' } });
  const [member, setMember] = useState(null);
  const [runs, setRuns] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [selectedRun, setRun] = useState(null);
  const courses = new Map();
  for (const item of runs) {
    if (!courses.has(item.courseId)) courses.set(item.courseId, { name: item.courseName, code: item.courseCode, runs: [] });
    courses.get(item.courseId).runs.push(item);
  }
  const course = courses.get(courseId);
  const [order, setOrder] = useState(null);
  const run = requestedOrderId || order ? selectedRun : course?.runs.find(item => item.id === selectedRun?.id && item.registrationStatus === 'OPEN');
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const keys = useRef({});
  const inFlight = useRef(false);
  const key = (action) => keys.current[action] ||= createCourseIdempotencyKey(action);
  useEffect(() => {
    if (!requestedOrderId) { setResuming(false); return; }
    let active = true;
    setResuming(true); setError(''); setOrder(null); setPayment(null); setMember(null); setRun(null);
    async function resume() {
      try {
        if (!requestedMemberCode) throw new Error('Missing member code');
        const selectedMember = await searchReceptionMember({ memberId: requestedMemberCode });
        const selectedOrder = await getReceptionCourseOrder(selectedMember.accountId, requestedOrderId);
        const selectedRun = await getCatalogCourseRun(selectedOrder.courseRunId).catch((err) => {
          if (err?.response?.status === 404) return null;
          throw err;
        });
        if (!active) return;
        setMember(selectedMember); setOrder(selectedOrder); setPayment(selectedOrder.payment); setRun(selectedRun);
        reset({ kind: 'memberId', query: selectedMember.memberId });
      } catch (err) {
        if (active) setError(getCourseErrorMessage(err, 'Không mở lại được đơn khóa học. Kiểm tra hội viên và thử tải lại.'));
      } finally { if (active) setResuming(false); }
    }
    resume();
    return () => { active = false; };
  }, [requestedOrderId, requestedMemberCode, resumeRevision, reset]);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    if (requestedOrderId) return;
    let active = true;
    if (!background) commitValue(setLoading, true);
    track(listAllCatalogCourseRuns().then((data) => {
      if (!active) return;
      commitValue(setRuns, data);
    }).catch((e) => { failed(e);  if (active) commitError(setError, getCourseErrorMessage(e)); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [catalogRevision, requestedOrderId], !busy);
  async function perform(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(getCourseErrorMessage(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function refresh(refreshPanels = true) {
    const updated = await getReceptionCourseOrder(member.accountId, order.orderId);
    setOrder(updated); setPayment(updated.payment);
    if (refreshPanels) refreshMemberPanels();
  }
  const activeOrderId = order?.orderId;
  const activeMemberId = member?.accountId;
  usePollingEffect(({ track, commitValue }) => {
    if (!activeOrderId || !activeMemberId) return;
    track(getReceptionCourseOrder(activeMemberId, activeOrderId).then(updated => {
      commitValue(setOrder, updated);
      commitValue(setPayment, updated.payment);
    }));
  }, [activeMemberId, activeOrderId], !busy && !resuming);
  const searchMember = ({ kind, query }) => perform(async () => {
        const previousMemberId = member?.accountId;
        setMember(null);
        const selected = await searchReceptionMember({ [kind]: kind === 'phone' ? normalizePhone(query) : query });
        if (previousMemberId !== selected.accountId) { keys.current = {}; setRun(null); }
        setMember(selected);
      });
  const payable = order?.orderStatus === 'PENDING_PAYMENT' && payment?.status !== 'PAID' && Date.parse(order.expiresAt) > now;
  if (resuming) return <div className="scms-course-workspace"><h1>Đăng ký khóa học</h1><p>Đang mở lại đơn khóa học…</p></div>;
  if (requestedOrderId && !order) return <div className="scms-course-workspace"><h1>Đăng ký khóa học</h1><Alert variant="danger">{error || 'Không tìm thấy đơn khóa học.'}</Alert><Button onClick={() => setResumeRevision((value) => value + 1)}>Thử lại</Button><Button className="ms-2" variant="outline-secondary" onClick={() => setSearchParams({})}>Về danh sách đợt học</Button></div>;
  return <div className="scms-course-workspace">
    <h1>Đăng ký khóa học</h1>
    <p className="text-muted mb-4">Đăng ký theo đợt học. Học phí khóa học độc lập với gói tập gym.</p>
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    <Card className="border-0 shadow-sm mb-4"><Card.Body>
      <CourseMemberLookup register={register} errors={errors} onSubmit={handleSubmit(searchMember)} disabled={busy || !!order} />
      {member && <p className="mt-3">{member.fullName} · {member.memberId} · {member.phone}</p>}
      {member && <ReceptionCourseActions key={"actions-" + member.accountId} member={member} run={run} refreshRevision={memberRevision} onChanged={refreshMemberPanels} />}
      {member && member.status !== 'ACTIVE' && <Alert variant="warning">Hội viên chưa ở trạng thái hoạt động.</Alert>}
    </Card.Body></Card>
    {!order && <Card className="border-0 shadow-sm mb-4"><Card.Body>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">Chọn khóa học</h2>
        <Button size="sm" variant="outline-secondary" disabled={loading || busy} onClick={() => setCatalogRevision(value => value + 1)}>Tải lại</Button>
      </div>
      {loading ? <p>Đang tải khóa học…</p> : !courses.size ? <p>Chưa có đợt học để đăng ký.</p> : (
        <Form.Select aria-label="Khóa học" value={course ? courseId : ''} disabled={busy} onChange={event => {
          setCourseId(event.target.value);
          setRun(null);
          keys.current = {};
        }}>
          <option value="">Chọn khóa học</option>
          {Array.from(courses, ([id, group]) => <option key={id} value={id}>{group.name} · {group.code} ({group.runs.length} đợt)</option>)}
        </Form.Select>
      )}
      {course && <Table responsive className="align-middle mt-3">
        <thead><tr><th>Mã đợt</th><th>Khai giảng</th><th>Huấn luyện viên</th><th>Học phí</th><th>Thao tác</th></tr></thead>
        <tbody>{course.runs.map(item => <tr key={item.id}>
          <td>{item.runCode}</td><td>{formatCourseDateTime(item.plannedStartAt)}</td>
          <td>{item.primaryCoachName}</td><td>{formatCourseMoney(item.tuitionVnd)}</td>
          <td><Button size="sm" variant={run?.id === item.id ? 'primary' : 'outline-primary'} disabled={busy || item.registrationStatus !== 'OPEN'} onClick={() => {
            if (run?.id !== item.id) keys.current = {};
            setRun(item);
          }}>{item.registrationStatus !== 'OPEN' ? 'Chưa mở hoặc đã đóng đăng ký' : run?.id === item.id ? 'Đã chọn' : 'Chọn đợt học'}</Button></td>
        </tr>)}</tbody>
      </Table>}
      <Button className="mt-2" disabled={busy || !run || member?.status !== 'ACTIVE'} onClick={() => perform(async () => {
        const created = await createReceptionCourseOrder(member.accountId, run.id, key('course-reception-order'));
        setOrder(created); setPayment(created.payment);
        setSearchParams({ orderId: created.orderId, memberCode: member.memberId }, { replace: true });
      })}>Tạo đơn đăng ký{run ? ` · ${run.runCode}` : ''}</Button>
    </Card.Body></Card>}
    {order && <Card><Card.Body>
      <p>Đơn {order.orderReference || 'khóa học'} · <Link to={'/reception/courses?orderId=' + encodeURIComponent(order.orderId) + '&memberCode=' + encodeURIComponent(member.memberId)}>Mở lại đơn này</Link></p>
      <h2>{run ? run.courseName + ' · ' + run.runCode : 'Đơn đăng ký khóa học'}</h2>
      <p>{getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, order.orderStatus)} · {formatCourseMoney(order.tuitionVnd)}</p>
      <p>Hạn giữ chỗ: {formatCourseDateTime(order.expiresAt)}</p>
      {order.orderStatus === 'PAID' && <Alert variant="success">Đã thanh toán khóa học.</Alert>}
      {payable && <div className="d-flex gap-2 mb-3">
        <Button disabled={busy || !!payment} onClick={() => setShowCashConfirmation(true)}>Xác nhận đã nhận đủ tiền mặt</Button>
        <Button disabled={busy || !!payment} onClick={() => perform(async () => {
          setPayment(await startReceptionCourseSepayPayment(member.accountId, order.orderId, key('course-sepay')));
        })}>Thanh toán chuyển khoản</Button>
      </div>}
      {payable && payment?.method === 'SEPAY' && payment.status === 'PENDING' && <>
        {payment.qrUrl && <img src={payment.qrUrl} alt="QR thanh toán khóa học" style={{ maxWidth: 280 }} />}
        <p>{payment.bankCode} · {payment.bankAccountNumber} · {payment.bankAccountName}</p>
        <p>Số tiền: {formatCourseMoney(payment.amount)} · Nội dung: {payment.paymentReference}</p>
      </>}
      <Button disabled={busy} onClick={() => perform(refresh)}>Cập nhật thanh toán</Button>
      {['PAID', 'EXPIRED'].includes(order.orderStatus) && <Button className="ms-2" disabled={busy} onClick={() => {
        setOrder(null); setPayment(null); setRun(null); keys.current = {}; setSearchParams({});
      }}>Đăng ký tiếp</Button>}
    </Card.Body></Card>}
    <Modal show={showCashConfirmation} onHide={() => { if (!busy) setShowCashConfirmation(false); }} centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>Xác nhận thu tiền khóa học</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>Hội viên: <strong>{member?.fullName} · {member?.memberId}</strong></p>
        <p>{run ? run.courseName + ' · ' + run.runCode : 'Đơn đăng ký khóa học'}</p>
        <p>Số tiền cần nhận: <strong>{formatCourseMoney(order?.tuitionVnd)}</strong></p>
        <p>Chỉ xác nhận khi đã nhận đủ tiền mặt. Hội viên sẽ được ghi danh sau khi xác nhận thành công.</p>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setShowCashConfirmation(false)}>Quay lại</Button><Button variant="danger" disabled={busy || !payable || !!payment} onClick={() => perform(async () => {
        let confirmed;
        try {
          confirmed = await confirmReceptionCourseCashPayment(member.accountId, order.orderId, key('course-cash'));
        } catch (e) {
          setError(getCourseErrorMessage(e, 'Chưa xác nhận được kết quả thu tiền. Kiểm tra thanh toán trước khi thử lại; thông tin gửi lại được giữ nguyên.'));
          return;
        }
        // Cash returns the fulfilled enrollment, not a payment DTO.
        setOrder(current => ({ ...current, orderId: confirmed.orderId, orderStatus: 'PAID', reservationStatus: 'ENROLLED' }));
        setShowCashConfirmation(false);
        refreshMemberPanels();
        try { await refresh(false); }
        catch { setError('Đã ghi nhận thanh toán, chưa tải lại được dữ liệu. Bấm Cập nhật thanh toán để tải lại; không cần xác nhận thu tiền lần nữa.'); }
      })}>{busy ? 'Đang xử lý…' : 'Xác nhận thu tiền'}</Button></Modal.Footer>
    </Modal>
  </div>;
}
