import { Link } from 'react-router-dom';
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  COURSE_RUN_STATUS_LABELS,
  COURSE_SESSION_STATUS_LABELS,
  COURSE_ORDER_STATUS_LABELS,
  formatCourseMoney,
  COURSE_ENROLLMENT_STATUS_LABELS,
  COURSE_DISPOSITION_LABELS,
  formatCourseDateTime,
  getCourseStatusLabel,
} from '../../../utils/courseUi';

export default function MemberCourseEnrollmentDetail({ enrollment }) {
 return (
                  <article className="member-course-card" >
                    <div className="member-course-card-head">
                      <div>
                        <small>{enrollment.courseCode} · {enrollment.runCode}</small>
                        <h3>{enrollment.courseName}</h3>
                      </div>
                      <span className="member-course-status">{getCourseStatusLabel(COURSE_ENROLLMENT_STATUS_LABELS, enrollment.lifecycleStatus)}</span>
                    </div>
                    <p>Đợt học: {getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, enrollment.courseRunStatus)}</p>
                    {enrollment.payment && <p>Thanh toán: {getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, enrollment.payment.status)} · {formatCourseMoney(enrollment.payment.amountVnd)}</p>}
                    <p>{enrollment.learningSuspended ? "Tạm ngừng học và điểm danh; vẫn giữ chỗ khi chờ rút." : ""}</p>
                    <p>Đăng ký lúc {formatCourseDateTime(enrollment.enrolledAt)}</p>
                    <p>Điểm danh: {(enrollment.sessions || []).filter((s) => s.attendanceStatus === 'PRESENT').length} có mặt · {(enrollment.sessions || []).filter((s) => s.attendanceStatus === 'ABSENT').length} vắng · {(enrollment.sessions || []).filter((s) => s.attendanceStatus === 'NOT_RECORDED').length} chưa ghi nhận</p>
                    <Link to="/member/class-sessions">Xem lịch cá nhân</Link>
                    <div className="member-course-session-stack">
                      {[...(enrollment.sessions || [])]
                        .sort((a, b) => a.unitNumber - b.unitNumber)
                        .map((session) => (
                          <div className="member-course-session-row" key={session.enrollmentSessionId}>
                            <strong>Buổi {session.unitNumber}{session.isMakeup ? " · Học bù" : ""}</strong>
                            <small>{getCourseStatusLabel(COURSE_SESSION_STATUS_LABELS, session.sessionStatus)}</small>
                            <span>{formatCourseDateTime(session.startAt)}</span>
                            <small>{session.disposition === 'ENROLLED' ? 'Đã phân bổ buổi học (lịch sử)' : getCourseStatusLabel(COURSE_DISPOSITION_LABELS, session.disposition)} · {getCourseStatusLabel(COURSE_ATTENDANCE_STATUS_LABELS, session.attendanceStatus)}</small>
                          </div>
                        ))}
                    </div>
                  </article>
 );
}
