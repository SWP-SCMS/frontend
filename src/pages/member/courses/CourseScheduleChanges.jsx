import { useEffect, useState } from 'react';
import { listMyCourseScheduleChanges } from '../../../services/courseEnrollmentService';
import { formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';

const statuses = { PENDING: 'Chờ phản hồi', RESPONDED: 'Đã phản hồi', SUPERSEDED: 'Đã có thay đổi mới thay thế', EXPIRED: 'Đã hết hạn' };
export default function CourseScheduleChanges({ enrollments }) {
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    listMyCourseScheduleChanges().then((data) => { if (active) setChanges(data); })
      .catch((e) => { if (active) setError(getCourseErrorMessage(e, 'Không tải được thay đổi lịch.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const sessions = new Map(enrollments.flatMap((e) => (e.sessions || []).map((s) => [s.enrollmentSessionId, `${e.courseName} · ${e.runCode} · Buổi ${s.unitNumber}`])));
  return <section className="member-course-section" id="schedule-changes">
    <h2>Thay đổi lịch khóa học</h2>
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Đang tải thay đổi lịch…</p> : !error && !changes.length && <p>Chưa có thay đổi lịch cần theo dõi.</p>}
    {changes.map((change) => <article className="member-course-card" key={change.id}>
      <h3>{sessions.get(change.enrollmentSessionId) || 'Buổi học của bạn'}</h3>
      <p>Lịch cũ: {formatCourseDateTime(change.oldStartAt)} – {formatCourseDateTime(change.oldEndAt)}</p>
      <p>Lịch mới: {formatCourseDateTime(change.newStartAt)} – {formatCourseDateTime(change.newEndAt)}</p>
      <p>{change.status === 'PENDING' && Date.parse(change.responseDeadline) <= Date.now() ? 'Đã hết hạn phản hồi' : statuses[change.status] || 'Đang cập nhật'} · Hạn phản hồi: {formatCourseDateTime(change.responseDeadline)}</p>
    </article>)}
  </section>;
}
