import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseMemberSearchSchema } from '../../../schemas/courseSchemas';
import { normalizePhone } from '../../../utils';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { searchReceptionMember } from '../../../services/receptionistService';
import { listCatalogCourseRuns } from '../../../services/courseCatalogService';
import { createReceptionCourseOrder, getReceptionCourseOrder, startReceptionCourseSepayPayment, confirmReceptionCourseCashPayment } from '../../../services/courseOrderService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { COURSE_ORDER_STATUS_LABELS, formatCourseMoney, formatCourseDateTime, getCourseStatusLabel, getCourseErrorMessage } from '../../../utils/courseUi';

export default function ReceptionCourseBookingPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(courseMemberSearchSchema), defaultValues: { kind: 'memberId', query: '' } });
  const [member, setMember] = useState(null);
  const [runs, setRuns] = useState([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [run, setRun] = useState(null);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const keys = useRef({});
  const inFlight = useRef(false);
  const key = (action) => keys.current[action] ||= createCourseIdempotencyKey(action);
  useEffect(() => {
    let active = true;
    setLoading(true);
    listCatalogCourseRuns({ page, size: 20 }).then((data) => {
      if (!active) return;
      setRuns(data.content || []);
      setLast(page + 1 >= data.totalPages);
    }).catch((e) => { if (active) setError(getCourseErrorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);
  async function perform(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(getCourseErrorMessage(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function refresh() {
    const updated = await getReceptionCourseOrder(member.accountId, order.orderId);
    setOrder(updated); setPayment(updated.payment);
  }
  const searchMember = ({ kind, query }) => perform(async () => {
        setMember(null); setRun(null); keys.current = {};
        setMember(await searchReceptionMember({ [kind]: kind === 'phone' ? normalizePhone(query) : query }));
      });
  const payable = order?.orderStatus === 'PENDING_PAYMENT' && Date.parse(order.expiresAt) > now;
  return <div className="container-fluid py-3">
    <h1>Đăng ký khóa học</h1>
    <p>Đăng ký theo đợt học. Học phí khóa học độc lập với gói tập gym.</p>
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    <Card className="mb-3"><Card.Body>
      <Form noValidate onSubmit={(event) => handleSubmit(searchMember)(event)}>
        <Form.Label htmlFor="course-member-kind">Tra cứu hội viên</Form.Label>
        <Form.Select id="course-member-kind" {...register('kind')} disabled={busy || !!order}>
          <option value="memberId">Mã hội viên</option><option value="phone">Số điện thoại</option>
        </Form.Select>
        <Form.Control className="my-2" aria-label="Mã hội viên hoặc số điện thoại" {...register('query')} isInvalid={!!errors.query} disabled={busy || !!order} />
        <Form.Control.Feedback type="invalid">{errors.query?.message}</Form.Control.Feedback>
        <Button type="submit" disabled={busy || !!order}>Tra cứu</Button>
      </Form>
      {member && <p className="mt-3">{member.fullName} · {member.memberId} · {member.phone}</p>}
      {member && member.status !== 'ACTIVE' && <Alert variant="warning">Hội viên chưa ở trạng thái hoạt động.</Alert>}
    </Card.Body></Card>
    {!order && <Card className="mb-3"><Card.Body>
      <h2>Chọn đợt học</h2>
      {loading ? <p>Đang tải đợt học…</p> : <>
        {!runs.length && <p>Chưa có đợt học để đăng ký.</p>}
        {runs.map((item) => <div key={item.id} className="border-bottom py-2">
          <strong>{item.courseName} · {item.runCode}</strong>
          <p>{formatCourseDateTime(item.plannedStartAt)} · {formatCourseMoney(item.tuitionVnd)}</p>
          <Button variant={run?.id === item.id ? 'primary' : 'outline-primary'} disabled={busy || item.registrationStatus !== 'OPEN'} onClick={() => { setRun(item); keys.current = {}; }}>
            {item.registrationStatus !== 'OPEN' ? 'Chưa mở hoặc đã đóng đăng ký' : run?.id === item.id ? 'Đã chọn' : 'Chọn đợt học'}
          </Button>
        </div>)}
      </>}
      <div className="d-flex gap-2 my-3"><Button disabled={busy || loading || page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button><Button disabled={busy || loading || last} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
      <Button disabled={busy || !run || member?.status !== 'ACTIVE'} onClick={() => perform(async () => {
        const created = await createReceptionCourseOrder(member.accountId, run.id, key('course-reception-order'));
        setOrder(created); setPayment(created.payment);
      })}>Tạo đơn đăng ký{run ? ` · ${run.runCode}` : ''}</Button>
    </Card.Body></Card>}
    {order && <Card><Card.Body>
      <h2>{run?.courseName} · {run?.runCode}</h2>
      <p>{getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, order.orderStatus)} · {formatCourseMoney(order.tuitionVnd)}</p>
      <p>Hạn giữ chỗ: {formatCourseDateTime(order.expiresAt)}</p>
      {order.orderStatus === 'PAID' && <Alert variant="success">Đã thanh toán khóa học.</Alert>}
      {payable && <div className="d-flex gap-2 mb-3">
        <Button disabled={busy || !!payment} onClick={() => perform(async () => {
          await confirmReceptionCourseCashPayment(member.accountId, order.orderId, key('course-cash'));
          await refresh();
        })}>Xác nhận đã nhận đủ tiền mặt</Button>
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
        setOrder(null); setPayment(null); setRun(null); keys.current = {};
      }}>Đăng ký tiếp</Button>}
    </Card.Body></Card>}
  </div>;
}
