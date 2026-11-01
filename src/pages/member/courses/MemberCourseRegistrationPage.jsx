import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCatalogCourseRun } from '../../../services/courseCatalogService';
import {
  createMyCourseOrder,
  getMyCourseOrder,
  startMyCourseSepayPayment,
} from '../../../services/courseOrderService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { joinCourseWaitlist } from '../../../services/courseWaitlistService';
import {
  COURSE_ORDER_STATUS_LABELS,
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorCode,
  getCourseErrorMessage,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './MemberCoursesPage.css';

export default function MemberCourseRegistrationPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialOrderId = searchParams.get('orderId');
  const [run, setRun] = useState(null);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [capacityFull, setCapacityFull] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const retryKeys = useRef({});
  const mutationLock = useRef(false);

  const orderId = order?.orderId || initialOrderId;

  const refreshOrder = useCallback(async (id) => {
    const nextOrder = await getMyCourseOrder(id);
    setOrder(nextOrder);
    if (nextOrder?.payment) setPayment(nextOrder.payment);
    return nextOrder;
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [runData, orderData] = await Promise.all([
          getCatalogCourseRun(runId).catch((error) => { if (initialOrderId && error?.response?.status === 404) return null; throw error; }),
          initialOrderId ? getMyCourseOrder(initialOrderId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setRun(runData);
        setOrder(orderData);
        setPayment(orderData?.payment || null);
      } catch (requestError) {
        if (active) setError(getCourseErrorMessage(requestError, 'Không tải được thông tin đăng ký khóa học.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [initialOrderId, runId]);

  useEffect(() => {
    if (!orderId || order?.orderStatus !== 'PENDING_PAYMENT') return undefined;
    const timer = window.setInterval(() => {
      refreshOrder(orderId).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [order?.orderStatus, orderId, refreshOrder]);

  const displayedPayment = payment || order?.payment;
  const isPaid = order?.orderStatus === 'PAID';
  const isExpired = order?.orderStatus === 'EXPIRED';
  const canRegister = run?.registrationStatus === 'OPEN';

  const sortedSessions = useMemo(
    () => [...(run?.sessions || [])].sort((a, b) => a.unitNumber - b.unitNumber),
    [run?.sessions],
  );

  async function handleCreateOrder() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    setCapacityFull(false);
    try {
      const created = await createMyCourseOrder(
        runId,
        retryKeys.current['order:' + runId] ||= createCourseIdempotencyKey('course-order-create'),
      );
      setOrder(created);
      setPayment(created?.payment || null);
      navigate(`/member/courses/${runId}/register?orderId=${created.orderId}`, { replace: true });
    } catch (requestError) {
      if (getCourseErrorCode(requestError) === 'COURSE_CAPACITY_FULL') setCapacityFull(true);
      setError(getCourseErrorMessage(requestError, 'Không thể tạo đơn đăng ký khóa học.'));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  async function handleJoinWaitlist() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      await joinCourseWaitlist(runId);
      setWaitlisted(true);
      setCapacityFull(false);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể tham gia danh sách chờ.'));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  async function handleStartPayment() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await startMyCourseSepayPayment(
        orderId,
        retryKeys.current['payment:' + orderId] ||= createCourseIdempotencyKey('course-payment-start'),
      );
      setPayment(result?.payment || result);
      await refreshOrder(orderId);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể tạo thông tin thanh toán.'));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  if (loading) return <div className="member-course-state">Đang tải thông tin đăng ký…</div>;

  return (
    <div className="member-course-page">
      <Link className="member-course-back" to={`/course-runs/${runId}`}>← Quay lại chi tiết khóa học</Link>
      <header className="member-course-heading compact">
        <div><p className="member-course-eyebrow">Đăng ký khóa học</p><h1>{run?.courseName || 'Khóa học'}</h1></div>
      </header>

      {error && <div className="member-course-alert">{error}</div>}
      {waitlisted && <div className="member-course-success">Bạn đã tham gia danh sách chờ. Hệ thống sẽ thông báo khi có chỗ.</div>}

      <div className="member-course-registration-grid">
        <section className="member-course-panel">
          <div className="member-course-card-head">
            <div><small>{run?.courseCode} · {run?.runCode}</small><h2>Thông tin đợt học</h2></div>
            <strong>{formatCourseMoney(run?.tuitionVnd)}</strong>
          </div>
          <dl className="member-course-info-list">
            <div><dt>Huấn luyện viên</dt><dd>{run?.primaryCoachName || 'Đang cập nhật'}</dd></div>
            <div><dt>Thời gian</dt><dd>{formatCourseDateTime(run?.plannedStartAt)} – {formatCourseDateTime(run?.plannedEndAt)}</dd></div>
            <div><dt>Số buổi</dt><dd>{run?.totalUnits ?? sortedSessions.length} buổi</dd></div>
            <div><dt>Sức chứa</dt><dd>{run?.capacity || '—'} học viên</dd></div>
          </dl>
          <div className="member-course-session-stack">
            {sortedSessions.map((session) => (
              <div className="member-course-session-row" key={session.id}>
                <strong>Buổi {session.unitNumber}</strong><span>{formatCourseDateTime(session.startAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="member-course-panel member-course-payment-panel">
          {isPaid ? (
            <div className="member-course-complete">
              <span>✓</span><h2>Thanh toán đã được xác nhận</h2><p>Xem Khóa học của tôi để theo dõi trạng thái đăng ký, lịch học và các yêu cầu rút hoặc chuyển đợt.</p>
              <Link className="member-course-primary-link" to="/member/courses">Xem khóa học của tôi</Link>
            </div>
          ) : isExpired ? (
            <div className="member-course-complete is-expired"><h2>Đơn đã hết hạn</h2><p>Vui lòng tạo đơn mới nếu đợt học vẫn còn mở.</p></div>
          ) : !orderId ? (
            <>
              <h2>Xác nhận đăng ký</h2>
              <p>Hệ thống sẽ giữ chỗ tạm thời trong lúc bạn hoàn tất thanh toán.</p>
              <button type="button" disabled={busy || !canRegister} onClick={handleCreateOrder}>
                {busy ? 'Đang xử lý…' : canRegister ? 'Tạo đơn đăng ký' : 'Chưa thể đăng ký'}
              </button>
              {capacityFull && <button className="is-secondary" type="button" disabled={busy} onClick={handleJoinWaitlist}>Tham gia danh sách chờ</button>}
            </>
          ) : (
            <>
              <div className="member-course-card-head"><h2>Thanh toán học phí</h2><span className="member-course-status">{getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, order?.orderStatus)}</span></div>
              <p>Đơn {order?.orderReference || 'đăng ký khóa học'} giữ chỗ đến {formatCourseDateTime(order?.expiresAt)}.</p>
              <p>Số tiền của đơn: <strong>{formatCourseMoney(order?.tuitionVnd, order?.currencyCode || 'VND')}</strong>.</p>
              {!displayedPayment ? (
                <button type="button" disabled={busy} onClick={handleStartPayment}>{busy ? 'Đang tạo…' : 'Tạo mã QR thanh toán'}</button>
              ) : (
                <div className="member-course-payment-details">
                  {displayedPayment.qrUrl && <img src={displayedPayment.qrUrl} alt="Mã QR thanh toán khóa học" />}
                  <dl className="member-course-info-list">
                    <div><dt>Ngân hàng</dt><dd>{displayedPayment.bankCode || '—'}</dd></div>
                    <div><dt>Số tài khoản</dt><dd>{displayedPayment.bankAccountNumber || '—'}</dd></div>
                    <div><dt>Chủ tài khoản</dt><dd>{displayedPayment.bankAccountName || '—'}</dd></div>
                    <div><dt>Số tiền</dt><dd>{formatCourseMoney(displayedPayment.amount, displayedPayment.currencyCode)}</dd></div>
                    <div><dt>Nội dung</dt><dd><strong>{displayedPayment.paymentReference || '—'}</strong></dd></div>
                    <div><dt>Hạn thanh toán</dt><dd>{formatCourseDateTime(displayedPayment.expiresAt)}</dd></div>
                  </dl>
                  <small>Trang sẽ tự cập nhật khi hệ thống xác nhận giao dịch.</small>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
