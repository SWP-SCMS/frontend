import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { listMyCourseScheduleChanges, respondToCourseScheduleChange } from '../../../services/courseEnrollmentService';
import { formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';
import { canRespondToCourseChange, COURSE_RESPONSE_LABELS } from '../../../utils/courseWorkflow';

const statuses = { PENDING: 'Chờ phản hồi', RESPONDED: 'Đã phản hồi', SUPERSEDED: 'Đã có thay đổi mới thay thế', EXPIRED: 'Đã hết hạn' };
export default function CourseScheduleChanges({ enrollments }) {
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
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    listMyCourseScheduleChanges().then((data) => { if (active) setChanges(data); })
      .catch((e) => { if (active) setError(getCourseErrorMessage(e, 'Không tải được thay đổi lịch.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  async function respond() {
    if (mutationLock.current || !choice || !canRespondToCourseChange(choice.change)) return;
    mutationLock.current = true; setBusy(true); setSubmitError('');
    try {
      const result = await respondToCourseScheduleChange(choice.change.id, choice.response);
      setChanges((items) => items.map((item) => item.id === result.id ? result : item));
      setNotice(choice.response === 'REQUEST_TRANSFER' ? 'Đã gửi yêu cầu chuyển đợt học cho quản lý.'
        : choice.response === 'REQUEST_WITHDRAWAL' ? 'Đã ghi nhận nguyện vọng rút do đổi lịch. Đây chưa phải yêu cầu rút đã được duyệt; vui lòng liên hệ lễ tân để được hỗ trợ.' : 'Đã xác nhận tiếp tục học theo lịch mới.');
      setChoice(null);
    } catch (err) { setSubmitError(getCourseErrorMessage(err, 'Chưa gửi được phản hồi. Vui lòng thử lại hoặc tải lại lịch.')); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const sessions = new Map(enrollments.flatMap((e) => (e.sessions || []).map((s) => [s.enrollmentSessionId, `${e.courseName} · ${e.runCode} · Buổi ${s.unitNumber}`])));
  return <section className="member-course-section" id="schedule-changes">
    <h2>Thay đổi lịch khóa học</h2>
    <Button variant="outline-secondary" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Tải lại thay đổi lịch</Button>
    {notice && <Alert variant="success" className="mt-3">{notice}</Alert>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Đang tải thay đổi lịch…</p> : !error && !changes.length && <p>Chưa có thay đổi lịch cần theo dõi.</p>}
    {!loading && !error && changes.map((change) => <article className="member-course-card mt-3" key={change.id}>
      <h3>{sessions.get(change.enrollmentSessionId) || 'Buổi học của bạn'}</h3>
      <p>Lịch cũ: {formatCourseDateTime(change.oldStartAt)} – {formatCourseDateTime(change.oldEndAt)}</p>
      <p>Lịch mới: {formatCourseDateTime(change.newStartAt)} – {formatCourseDateTime(change.newEndAt)}</p>
      <p>{change.status === 'PENDING' && Date.parse(change.responseDeadline) <= now ? 'Đã hết hạn phản hồi' : statuses[change.status] || 'Đang cập nhật'} · Hạn phản hồi: {formatCourseDateTime(change.responseDeadline)}</p>
      {change.response && <p>Phản hồi: {COURSE_RESPONSE_LABELS[change.response] || 'Đã ghi nhận'} · {formatCourseDateTime(change.respondedAt)}</p>}
      {canRespondToCourseChange(change, now) && <div className="d-flex gap-2 flex-wrap">{Object.entries(COURSE_RESPONSE_LABELS).map(([response, label]) => <Button key={response} variant="outline-primary" disabled={busy} onClick={() => { setSubmitError(''); setChoice({ change, response }); }}>{label}</Button>)}</div>}
    </article>)}
    <Modal show={!!choice} onHide={() => { if (!busy) setChoice(null); }} centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>Xác nhận phản hồi đổi lịch</Modal.Title></Modal.Header><Modal.Body>
        {submitError && <Alert variant="danger">{submitError}</Alert>}
        <p>{COURSE_RESPONSE_LABELS[choice?.response]}. Phản hồi đã gửi không thể thay đổi.</p>
        {choice?.response === 'REQUEST_WITHDRAWAL' && <p>Thao tác này ghi nhận nguyện vọng rút do thay đổi lịch; chưa tự rút khỏi khóa hay xác định khoản hoàn. Liên hệ lễ tân để được hỗ trợ xử lý.</p>}
      </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setChoice(null)}>Đóng</Button><Button disabled={busy || !choice || !canRespondToCourseChange(choice.change, now)} onClick={respond}>Gửi phản hồi</Button></Modal.Footer>
    </Modal>
  </section>;
}
