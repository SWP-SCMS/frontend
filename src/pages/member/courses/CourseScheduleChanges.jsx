import usePollingEffect from '../../../hooks/usePollingEffect';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { listMyCourseScheduleChanges, respondToCourseScheduleChange } from '../../../services/courseEnrollmentService';
import { formatCourseMoney, formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';
import { canRespondToCourseChange, COURSE_RESPONSE_LABELS } from '../../../utils/courseWorkflow';

const statuses = { PENDING: 'Chờ phản hồi', RESPONDED: 'Đã phản hồi', SUPERSEDED: 'Đã có thay đổi mới thay thế', EXPIRED: 'Đã hết hạn' };
export default function CourseScheduleChanges({ enrollments, onResponded, selectedEnrollmentId = '' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const mutationLock = useRef(false);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, '');
    track(listMyCourseScheduleChanges().then((data) => { if (active) commitValue(setChanges, data); })
      .catch((e) => { failed(e);  if (active) commitError(setError, getCourseErrorMessage(e, 'Không tải được thay đổi lịch.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [revision], !busy);
  async function respond() {
    if (mutationLock.current || !choice || !canRespondToCourseChange(choice.change)) return;
    mutationLock.current = true; setBusy(true); setSubmitError('');
    try {
      const result = await respondToCourseScheduleChange(choice.change.id, choice.response);
      setChanges((items) => items.map((item) => item.id === result.id ? result : item));
      setNotice(choice.response === 'REQUEST_TRANSFER' ? 'Đã gửi yêu cầu chuyển đợt học cho quản lý.'
        : choice.response === 'REQUEST_WITHDRAWAL' ? 'Đã gửi yêu cầu rút do đổi lịch, chờ quản lý duyệt.' : 'Đã xác nhận tiếp tục học theo lịch mới.');
      setChoice(null);
      if (choice.response === 'REQUEST_WITHDRAWAL') await onResponded?.();
    } catch (err) { setSubmitError(getCourseErrorMessage(err, 'Chưa gửi được phản hồi. Vui lòng thử lại hoặc tải lại lịch.')); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const sessions = new Map(enrollments.flatMap((e) => (e.sessions || []).map((s) => [s.enrollmentSessionId, `${e.courseName} · ${e.runCode} · Buổi ${s.unitNumber}`])));
  return <section className="member-course-section" id="schedule-changes">
    <h2>Thay đổi lịch khóa học</h2>
    <Button variant="outline-secondary" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Tải lại thay đổi lịch</Button>
    {notice && <Alert variant="success" className="mt-3">{notice}</Alert>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Đang tải thay đổi lịch…</p> : !error && !changes.some(c => !selectedEnrollmentId || sessions.has(c.enrollmentSessionId)) && <p>Chưa có thay đổi lịch cần theo dõi.</p>}
    {!loading && !error && changes.filter(c => !selectedEnrollmentId || sessions.has(c.enrollmentSessionId)).map((change) => <article className="member-course-card mt-3" key={change.id}>
      <h3>{sessions.get(change.enrollmentSessionId) || 'Buổi học của bạn'}</h3>
      <p>Lịch cũ: {formatCourseDateTime(change.oldStartAt)} – {formatCourseDateTime(change.oldEndAt)}</p>
      <p>Lịch mới: {formatCourseDateTime(change.newStartAt)} – {formatCourseDateTime(change.newEndAt)}</p>
      <p>{change.status === 'PENDING' && Date.parse(change.responseDeadline) <= now ? 'Đã hết hạn phản hồi' : statuses[change.status] || 'Đang cập nhật'} · Hạn phản hồi: {formatCourseDateTime(change.responseDeadline)}</p>
      <p>{change.withdrawalEligible ? "Được gửi yêu cầu rút" : "Chưa đủ điều kiện gửi yêu cầu rút"} · Khoản hoàn dự kiến: {formatCourseMoney(change.refundAmountVnd)}</p>
      {change.response && <p>Phản hồi: {COURSE_RESPONSE_LABELS[change.response] || 'Đã ghi nhận'} · {formatCourseDateTime(change.respondedAt)}</p>}
      {canRespondToCourseChange(change, now) && <div className="d-flex gap-2 flex-wrap">{Object.entries(COURSE_RESPONSE_LABELS).map(([response, label]) => <Button key={response} variant="outline-primary" disabled={busy || (response === 'REQUEST_WITHDRAWAL' && !change.withdrawalEligible)} onClick={() => { setSubmitError(''); setChoice({ change, response }); }}>{label}</Button>)}</div>}
    </article>)}
    <Modal show={!!choice} onHide={() => { if (!busy) setChoice(null); }} centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>Xác nhận phản hồi đổi lịch</Modal.Title></Modal.Header><Modal.Body>
        {submitError && <Alert variant="danger">{submitError}</Alert>}
        <p>{COURSE_RESPONSE_LABELS[choice?.response]}. Phản hồi đã gửi không thể thay đổi.</p>
        {choice?.response === 'REQUEST_WITHDRAWAL' && <p>Thao tác này tạo yêu cầu rút để Quản lý duyệt và tạm ngừng học/điểm danh, vẫn giữ chỗ. Không bù buổi đã lỡ nếu hủy hoặc bị từ chối. Khoản hoàn được xử lý riêng, chưa phải đã chi tiền.</p>}
      </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setChoice(null)}>Đóng</Button><Button disabled={busy || !choice || !canRespondToCourseChange(choice.change, now)} onClick={respond}>Gửi phản hồi</Button></Modal.Footer>
    </Modal>
  </section>;
}
