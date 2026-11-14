import Badge from '../../../components/common/SystemBadge';
import './CourseScheduleChanges.css';
import { groupCourseScheduleChanges, applyCourseScheduleGroupResponse } from '../../../utils/courseScheduleChangeGroups';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { listMyCourseScheduleChanges, respondToCourseScheduleChange } from '../../../services/courseEnrollmentService';
import { formatCourseMoney, formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';
import { canRespondToCourseChange, COURSE_RESPONSE_LABELS } from '../../../utils/courseWorkflow';

const statuses = { PENDING: 'Chờ phản hồi', RESPONDED: 'Đã phản hồi', SUPERSEDED: 'Đã có thay đổi mới thay thế', EXPIRED: 'Đã hết hạn' };
const dateFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function ScheduleMoment({ startAt, endAt, updated = false }) {
  const start = new Date(startAt), end = new Date(endAt);
  const validStart = !!startAt && Number.isFinite(start.getTime());
  const validEnd = !!endAt && Number.isFinite(end.getTime());
  return <div className={`course-change-moment${updated ? ' is-new' : ''}`}>
    <span className="course-change-moment-label">{updated ? 'Lịch mới' : 'Lịch cũ'}</span>
    <strong>{validStart ? dateFormat.format(start) : '—'}</strong>
    <span className="course-change-time">{validStart ? timeFormat.format(start) : '—'} – {validEnd ? timeFormat.format(end) : '—'}</span>
    {validStart && validEnd && dateFormat.format(start) !== dateFormat.format(end) && <small>Kết thúc ngày {dateFormat.format(end)}</small>}
  </div>;
}

function ScheduleComparison({ change, sessions }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className="course-change-comparison">
    <div id={id} aria-label="So sánh lịch học">
      {change.changes.slice(0, expanded ? change.changes.length : 1).map(item => <div key={item.id} className="course-change-session">
        <span className="course-change-unit">Buổi {sessions.get(item.enrollmentSessionId) || 'học'}</span>
        <ScheduleMoment startAt={item.oldStartAt} endAt={item.oldEndAt} />
        <span className="course-change-arrow" aria-hidden="true">→</span>
        <ScheduleMoment startAt={item.newStartAt} endAt={item.newEndAt} updated />
      </div>)}
    </div>
    {change.changes.length > 1 && <button type="button" className="course-change-expand" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Thu gọn' : `Xem tất cả (${change.changes.length} buổi)`}
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
    </button>}
  </div>;
}

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
  const noticeTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
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
      setChanges((items) => applyCourseScheduleGroupResponse(items, choice.change, result));
      setRevision(value => value + 1);
      setNotice(choice.response === 'REQUEST_WITHDRAWAL' ? 'Đã gửi yêu cầu hủy do đổi lịch, chờ quản lý duyệt.' : 'Đã xác nhận tiếp tục học theo lịch mới.');
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(''), 4000);
      setChoice(null);
      if (choice.response === 'REQUEST_WITHDRAWAL') await onResponded?.();
    } catch (err) { setSubmitError(getCourseErrorMessage(err, 'Chưa gửi được phản hồi. Vui lòng thử lại hoặc tải lại lịch.')); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const sessions = new Map(enrollments.flatMap((e) => (e.sessions || []).map((s) => [s.enrollmentSessionId, s.unitNumber])));
  const groups = groupCourseScheduleChanges(changes.filter(change => !selectedEnrollmentId || sessions.has(change.enrollmentSessionId)), enrollments);
  const requestingWithdrawal = choice?.response === 'REQUEST_WITHDRAWAL';
  return <section className="course-change-section" id="schedule-changes">
    <div className="course-change-toolbar">
      <h2>Thay đổi lịch học</h2>
      <Button variant="outline-secondary" size="sm" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>
        <span aria-hidden="true">↻</span> Tải lại thay đổi lịch
      </Button>
    </div>
    {notice && <Alert variant="success">{notice}</Alert>}
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p role="status">Đang tải thay đổi lịch…</p> : !error && !groups.length && <p className="course-change-empty">Chưa có thay đổi lịch cần theo dõi.</p>}
    <div className="course-change-list">
      {!loading && !error && groups.map((change) => {
        const expired = change.status === 'PENDING' && Date.parse(change.responseDeadline) <= now;
        const canRespond = canRespondToCourseChange(change, now);
        return <article className="course-change-card" key={change.key}>
          <header className="course-change-card-header">
            <div className="course-change-course">
              <span className="course-change-calendar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m2 0h2"/></svg></span>
              <div><h3>{change.owner?.courseName || 'Khóa học của bạn'}</h3>
                <div className="course-change-course-meta">{change.owner?.runCode && <span>{change.owner.runCode}</span>}<span>{change.changes.length} buổi thay đổi</span></div>
              </div>
            </div>
            <Badge tone={canRespond ? 'amber' : change.status === 'RESPONDED' ? 'blue' : 'neutral'}>{expired ? 'Đã hết hạn phản hồi' : statuses[change.status] || 'Đang cập nhật'}</Badge>
          </header>
          <ScheduleComparison change={change} sessions={sessions} />
          <div className="course-change-summary">
            <div className="course-change-deadline"><span>Hạn phản hồi</span><strong>{formatCourseDateTime(change.responseDeadline)}</strong></div>
            {change.refundAmountVnd != null && <div className="course-change-refund"><span>Hoàn dự kiến khi hủy</span><strong>{formatCourseMoney(change.refundAmountVnd)}</strong></div>}
          </div>
          {change.response && <div className="course-change-recorded"><strong>{COURSE_RESPONSE_LABELS[change.response] || 'Đã ghi nhận phản hồi'}</strong><span>{formatCourseDateTime(change.respondedAt)}</span></div>}
          {canRespond && <footer className="course-change-actions">
            {!change.withdrawalEligible && <span className="course-change-unavailable">Chưa đủ điều kiện yêu cầu hủy.</span>}
            <div>{Object.entries(COURSE_RESPONSE_LABELS).map(([response, label]) => <Button key={response} variant={response === 'CONTINUE' ? 'danger' : 'outline-danger'} disabled={busy || (response === 'REQUEST_WITHDRAWAL' && !change.withdrawalEligible)} onClick={() => { setSubmitError(''); setChoice({ change, response }); }}>{label}</Button>)}</div>
          </footer>}
        </article>;
      })}
    </div>
    <Modal show={!!choice} onHide={() => { if (!busy) setChoice(null); }} centered scrollable backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>{requestingWithdrawal ? 'Yêu cầu hủy khóa học' : 'Xác nhận theo lịch mới'}</Modal.Title></Modal.Header><Modal.Body>
        {submitError && <Alert variant="danger">{submitError}</Alert>}
        <div className="course-change-confirm-course">
          <strong>{choice?.change.owner?.courseName || 'Khóa học của bạn'}</strong>
          {choice?.change.owner?.runCode && <span>Đợt học: {choice.change.owner.runCode}</span>}
        </div>
        {requestingWithdrawal ? <>
          <p>Bạn muốn rút khỏi <strong>toàn bộ đợt học này</strong> do lịch thay đổi? Yêu cầu sẽ được gửi đến quản lý để xét duyệt.</p>
          {choice.change.refundAmountVnd != null && <div className="course-change-confirm-refund">
            <span>Hoàn tiền dự kiến</span><strong>{formatCourseMoney(choice.change.refundAmountVnd)}</strong>
            <small>Khoản hoàn được xử lý sau khi yêu cầu được duyệt.</small>
          </div>}
          <ul className="course-change-confirm-notes">
            <li>Trong lúc chờ duyệt, bạn tạm ngừng học và điểm danh. Chỗ học vẫn được giữ.</li>
            <li>Nếu bạn hủy yêu cầu hoặc quản lý từ chối, bạn được học tiếp. Các buổi bỏ lỡ trong thời gian chờ sẽ không được học bù.</li>
            <li>Bạn có thể theo dõi hoặc hủy yêu cầu đang chờ duyệt tại mục <strong>Rút khóa học</strong>.</li>
          </ul>
        </> : <>
          <p>Bạn đồng ý tiếp tục học theo lịch mới của <strong>toàn bộ các buổi trong lần thay đổi này</strong> ({choice?.change.changes.length || 0} buổi).</p>
          <p className="text-muted mb-0">Sau khi xác nhận, phản hồi này không thể thay đổi.</p>
        </>}
      </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setChoice(null)}>Quay lại</Button><Button disabled={busy || !choice || !canRespondToCourseChange(choice.change, now)} onClick={respond}>{busy ? 'Đang gửi…' : requestingWithdrawal ? 'Gửi yêu cầu hủy' : 'Xác nhận theo lịch mới'}</Button></Modal.Footer>
    </Modal>
  </section>;
}
