import Badge from '../../../components/common/SystemBadge';
import SessionTime from '../../../components/common/SessionTime';
import { Link } from 'react-router-dom';
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  COURSE_RUN_STATUS_LABELS,
  COURSE_SESSION_STATUS_LABELS,
  COURSE_ORDER_STATUS_LABELS,
  COURSE_DISPOSITION_LABELS,
  formatCourseMoney,
  courseEnrollmentStatusLabel,
  formatCourseDateTime,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './MemberCourseEnrollmentDetail.css';

const cancelledStatuses = ['CANCELLED', 'CANCELLED_PENDING_MAKEUP', 'REMOVED_BY_RUN_CHANGE', 'RESOLVED_BY_REFUND'];

export default function MemberCourseEnrollmentDetail({ enrollment }) {
  const sessions = [...(enrollment.sessions || [])].sort((a, b) => a.unitNumber - b.unitNumber);
  const present = sessions.filter(s => s.attendanceStatus === 'PRESENT').length;
  const absent = sessions.filter(s => s.attendanceStatus === 'ABSENT').length;
  const pending = sessions.filter(s => s.attendanceStatus === 'NOT_RECORDED' && !cancelledStatuses.includes(s.sessionStatus)).length;
  const cancelled = sessions.filter(s => cancelledStatuses.includes(s.sessionStatus)).length;
  return <article className="member-course-card member-enrollment-detail">
    <header className="member-course-card-head">
      <div>
        <small>{enrollment.courseCode} · {enrollment.runCode}</small>
        <h3>{enrollment.courseName}</h3>
        <p className="member-enrollment-run-state">Đợt học: {getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, enrollment.courseRunStatus)}</p>
      </div>
      <Badge className="member-course-status">{courseEnrollmentStatusLabel(enrollment)}</Badge>
    </header>

    {enrollment.learningSuspended && enrollment.courseRunStatus !== 'CANCELLED' && <p className="member-course-alert">Tạm ngừng học và điểm danh; vẫn giữ chỗ khi chờ rút.</p>}

    <dl className="member-enrollment-overview">
      <div>
        <dt>Thanh toán</dt>
        <dd>{enrollment.payment ? <><strong>{formatCourseMoney(enrollment.payment.amountVnd)}</strong><span>{getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, enrollment.payment.status)}</span></> : 'Chưa có thông tin'}</dd>
      </div>
      <div>
        <dt>Ngày đăng ký</dt>
        <dd><strong>{formatCourseDateTime(enrollment.enrolledAt)}</strong><span>Mã đợt: {enrollment.runCode}</span></dd>
      </div>
      <div>
        <dt>Điểm danh</dt>
        <dd><strong>{present} có mặt · {absent} vắng</strong><span>{[pending > 0 && `${pending} chưa điểm danh`, cancelled > 0 && `${cancelled} buổi đã hủy hoặc ngừng học`].filter(Boolean).join(' · ') || `${sessions.length} buổi học`}</span></dd>
      </div>
    </dl>

    <section aria-labelledby="enrollment-sessions-title" className="member-enrollment-sessions">
      <div className="member-enrollment-sessions-heading">
        <div><h4 id="enrollment-sessions-title">Các buổi học</h4><span>{sessions.length} buổi</span></div>
        <Link to="/member/class-sessions">Xem lịch cá nhân →</Link>
      </div>
      {!sessions.length ? <p>Chưa có buổi học.</p> : <table className="member-enrollment-session-table" aria-label="Các buổi học đã đăng ký">
        <thead><tr><th scope="col">Buổi</th><th scope="col">Thời gian</th><th scope="col">Phòng / Huấn luyện viên</th><th scope="col">Trạng thái</th><th scope="col">Điểm danh</th></tr></thead>
        <tbody>{sessions.map(session => {
          const inactive = cancelledStatuses.includes(session.sessionStatus);
          return <tr key={session.enrollmentSessionId}>
            <th scope="row">Buổi {session.unitNumber}{session.isMakeup && <small>Học bù</small>}</th>
            <td data-label="Thời gian"><SessionTime startAt={session.startAt} endAt={session.endAt} /></td>
            <td data-label="Phòng / HLV"><span>{session.roomName || 'Chưa có phòng'}</span><small>{session.coachName || 'Chưa phân công HLV'}</small></td>
            <td data-label="Trạng thái"><Badge>{getCourseStatusLabel(COURSE_SESSION_STATUS_LABELS, session.sessionStatus)}</Badge>{!inactive && session.disposition && session.disposition !== 'ENROLLED' && <small>{getCourseStatusLabel(COURSE_DISPOSITION_LABELS, session.disposition)}</small>}</td>
            <td data-label="Điểm danh">{inactive && session.attendanceStatus === 'NOT_RECORDED' ? 'Không áp dụng' : getCourseStatusLabel(COURSE_ATTENDANCE_STATUS_LABELS, session.attendanceStatus)}</td>
          </tr>;
        })}</tbody>
      </table>}
    </section>
  </article>;
}
