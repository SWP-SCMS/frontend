import Badge from '../../../components/common/SystemBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { acceptCourseTransferOffer, listMyCourseTransferOffers } from '../../../services/courseWorkflowService';
import { getCatalogCourseRun } from '../../../services/courseCatalogService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import { COURSE_TRANSFER_STATUS_LABELS, canAcceptCourseTransfer } from '../../../utils/courseWorkflow';
import { COURSE_SESSION_STATUS_LABELS, formatCourseDateTime, formatCourseMoney, getCourseErrorMessage } from '../../../utils/courseUi';

export default function MemberCourseTransfers({ enrollments, onTransferred, selectedEnrollmentId = '' }) {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const keys = useRef({});
  const mutationLock = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, '');
    track(listMyCourseTransferOffers().then((data) => { if (active) commitValue(setOffers, data); })
      .catch((err) => { failed(err);  if (active) commitError(setError, getCourseErrorMessage(err, 'Không tải được đề nghị chuyển đợt học.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [revision], !busy);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setTarget, null); commitError(setTargetError, ''); if (!background) commitValue(setTargetLoading, !!selected);
    if (selected) track(getCatalogCourseRun(selected.targetRunId)
      .then((data) => { if (active) commitValue(setTarget, data); })
      .catch((err) => { failed(err);  if (active) commitError(setTargetError, getCourseErrorMessage(err, 'Chưa tải được lịch đợt học thay thế. Đợt học có thể không còn công khai; vui lòng liên hệ lễ tân.')); })
      .finally(() => { if (active) if (!background) commitValue(setTargetLoading, false); }));
    return () => { active = false; };
  }, [selected], !busy);

  async function accept() {
    if (mutationLock.current || !target || !canAcceptCourseTransfer(selected)) return;
    mutationLock.current = true; setBusy(true); setTargetError('');
    try {
      const result = await acceptCourseTransferOffer(selected.id, keys.current[selected.id] ||= createCourseIdempotencyKey('course-transfer'));
      setOffers((items) => items.map((item) => item.id === result.id ? result : item));
      setSelected(null);
      if (result.status === 'PENDING_PAYMENT' && result.differenceOrderId) {
        navigate('/member/courses/' + result.targetRunId + '/register?orderId=' + encodeURIComponent(result.differenceOrderId));
      } else {
        setNotice(result.status === 'COMPLETED' ? 'Đã chuyển đợt học. Lịch cá nhân được cập nhật theo đợt mới.' : 'Đã ghi nhận chấp nhận đề nghị.');
        onTransferred?.();
      }
    } catch (err) {
      setTargetError(getCourseErrorMessage(err, 'Chưa xác nhận được kết quả. Có thể thử lại hoặc tải lại danh sách để kiểm tra.'));
    } finally { mutationLock.current = false; setBusy(false); }
  }

  const sourceNames = new Map(enrollments.map((item) => [item.enrollmentId, item.courseName + ' · ' + item.runCode]));
  const runNames = new Map(enrollments.map((item) => [item.courseRunId, item.courseName + ' · ' + item.runCode]));
  return <section className="member-course-section" id="transfers">
    <h2>Chuyển đợt học</h2><p>Các đề nghị được quản lý duyệt sau khi bạn yêu cầu chuyển do thay đổi lịch.</p>
    <Button variant="outline-secondary" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Tải lại đề nghị</Button>
    {error && <Alert variant="danger" className="mt-3">{error}</Alert>}{notice && <Alert variant="success" className="mt-3">{notice}</Alert>}
    {loading ? <p>Đang tải…</p> : !error && <>
      {!offers.some(o => !selectedEnrollmentId || o.sourceEnrollmentId === selectedEnrollmentId) && <p>Chưa có đề nghị chuyển đợt học.</p>}
      {offers.filter(o => !selectedEnrollmentId || o.sourceEnrollmentId === selectedEnrollmentId).map((offer) => <article key={offer.id} className="member-course-card mt-3">
        <h3>{(offer.sourceCourseName ? offer.sourceCourseName + ' · ' + offer.sourceRunCode : sourceNames.get(offer.sourceEnrollmentId)) || 'Đăng ký khóa học của bạn'}</h3>
        <p>Đợt học thay thế: {offer.targetCourseName ? offer.targetCourseName + ' · ' + offer.targetRunCode : runNames.get(offer.targetRunId) || 'Chưa có thông tin'}</p>
        <p><Badge>{COURSE_TRANSFER_STATUS_LABELS[offer.status] || 'Đang cập nhật'}</Badge> · Hạn chấp nhận/thanh toán: {formatCourseDateTime(offer.expiresAt)}</p>
        <dl><dt>Giá trị được chuyển</dt><dd>{formatCourseMoney(offer.creditVnd)}</dd><dt>Học phí đợt mới</dt><dd>{formatCourseMoney(offer.targetTuitionVnd)}</dd><dt>Chênh lệch theo đề nghị</dt><dd>{formatCourseMoney(offer.differenceVnd)}</dd></dl>
        {canAcceptCourseTransfer(offer, now) && <Button disabled={busy} onClick={() => setSelected(offer)}>Xem đợt thay thế và chấp nhận</Button>}
        {offer.status === 'OFFERED' && Date.parse(offer.expiresAt) <= now && <p>Đề nghị đã hết thời hạn chấp nhận.</p>}
        {offer.status === 'PENDING_PAYMENT' && offer.differenceOrderId && <Link to={'/member/courses/' + offer.targetRunId + '/register?orderId=' + encodeURIComponent(offer.differenceOrderId)}>Xem đơn thanh toán chênh lệch</Link>}
      </article>)}
    </>}
    <Modal show={!!selected} onHide={() => { if (!busy) setSelected(null); }} size="lg" centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>Chấp nhận chuyển đợt học</Modal.Title></Modal.Header><Modal.Body>
        {targetError && <Alert variant="danger">{targetError}</Alert>}
        {targetLoading ? <p>Đang tải lịch học thay thế…</p> : target && selected && <>
          <h3 className="h5">{target.courseName} · {target.runCode}</h3>
          <p>{formatCourseDateTime(target.plannedStartAt)} – {formatCourseDateTime(target.plannedEndAt)}</p>
          <p>Huấn luyện viên: {target.primaryCoachName || 'Đang cập nhật'}</p>
          <ul>{target.sessions?.map((session) => <li key={session.id}>Buổi {session.unitNumber}: {formatCourseDateTime(session.startAt)} – {formatCourseDateTime(session.endAt)} · <Badge>{COURSE_SESSION_STATUS_LABELS[session.status] || 'Chưa có trạng thái'}</Badge></li>)}</ul>
          <p>Chênh lệch theo đề nghị: <strong>{formatCourseMoney(selected.differenceVnd)}</strong>. Khoản dương cần thanh toán; khoản âm được xử lý qua quy trình hoàn tiền.</p>
          <p>Hạn chấp nhận/thanh toán: {formatCourseDateTime(selected.expiresAt)}.</p>
        </>}
      </Modal.Body><Modal.Footer>
        <Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Đóng</Button>
        <Button disabled={busy || targetLoading || !target || !selected || !canAcceptCourseTransfer(selected, now)} onClick={accept}>{busy ? 'Đang xử lý…' : 'Chấp nhận đề nghị'}</Button>
      </Modal.Footer>
    </Modal>
  </section>;
}
