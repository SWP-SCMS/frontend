import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listMyCourseEnrollments } from '../../../services/courseEnrollmentService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import {
  acceptCourseWaitlistInvitation,
  leaveCourseWaitlist,
  listMyCourseWaitlists,
} from '../../../services/courseWaitlistService';
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  COURSE_RUN_STATUS_LABELS,
  COURSE_SESSION_STATUS_LABELS,
  COURSE_ORDER_STATUS_LABELS,
  formatCourseMoney,
  COURSE_ENROLLMENT_STATUS_LABELS,
  COURSE_DISPOSITION_LABELS,
  COURSE_WAITLIST_STATUS_LABELS,
  formatCourseDateTime,
  getCourseErrorMessage,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import MemberCourseRefunds from './MemberCourseRefunds';
import MemberCourseWithdrawals from './MemberCourseWithdrawals';
import CourseScheduleChanges from './CourseScheduleChanges';
import MemberCourseTransfers from './MemberCourseTransfers';
import './MemberCoursesPage.css';



export default function MemberCoursesPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [enrollments, setEnrollments] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sectionId = hash.slice(1);
    if (!loading && ['refunds', 'withdrawals', 'transfers', 'schedule-changes'].includes(sectionId)) {
      document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    }
  }, [hash, loading]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const acceptKeys = useRef({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [enrollmentData, waitlistData] = await Promise.allSettled([
        listMyCourseEnrollments(),
        listMyCourseWaitlists(),
      ]);
      setEnrollments(enrollmentData.status === 'fulfilled' ? enrollmentData.value : []);
      setWaitlists(waitlistData.status === 'fulfilled' ? waitlistData.value : []);
      if ([enrollmentData, waitlistData].some((result) => result.status === 'rejected')) setError('Một phần dữ liệu chưa tải được. Vui lòng tải lại.');
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không tải được thông tin khóa học của bạn.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLeave(item) {
    setBusyId(item.id);
    setError('');
    try {
      await leaveCourseWaitlist(item.courseRunId);
      await load();
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể rời danh sách chờ.'));
    } finally {
      setBusyId('');
    }
  }

  async function handleAccept(item) {
    setBusyId(item.id);
    setError('');
    try {
      const order = await acceptCourseWaitlistInvitation(
        item.id,
        acceptKeys.current[item.id] ||= createCourseIdempotencyKey('course-waitlist-accept'),
      );
      navigate(`/member/courses/${item.courseRunId}/register?orderId=${order.orderId}`);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể nhận chỗ được mời.'));
    } finally {
      setBusyId('');
    }
  }

  const activeWaitlists = waitlists;

  return (
    <div className="member-course-page">
      <header className="member-course-heading">
        <div>
          <p className="member-course-eyebrow">Khóa học chuyên đề</p>
          <h1>Khóa học của tôi</h1>
          <p>Theo dõi khóa đã đăng ký, lịch học và vị trí trong danh sách chờ.</p>
        </div>
        <Link className="member-course-primary-link" to="/courses">Khám phá khóa học</Link>
      </header>

      <button type="button" disabled={loading || !!busyId} onClick={load}>Tải lại dữ liệu</button>
      {error && <div className="member-course-alert">{error}</div>}
      {loading ? (
        <div className="member-course-state">Đang tải dữ liệu khóa học…</div>
      ) : (
        <>
          <section className="member-course-section">
            <div className="member-course-section-title">
              <h2>Khóa đã đăng ký</h2>
              <span>{enrollments.length} khóa</span>
            </div>
            {enrollments.length ? (
              <div className="member-course-grid">
                {enrollments.map((enrollment) => (
                  <article className="member-course-card" key={enrollment.enrollmentId}>
                    <div className="member-course-card-head">
                      <div>
                        <small>{enrollment.courseCode} · {enrollment.runCode}</small>
                        <h3>{enrollment.courseName}</h3>
                      </div>
                      <span className="member-course-status">{getCourseStatusLabel(COURSE_ENROLLMENT_STATUS_LABELS, enrollment.lifecycleStatus)}</span>
                    </div>
                    <p>Đợt học: {getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, enrollment.courseRunStatus)}</p>
                    {enrollment.payment && <p>Thanh toán: {getCourseStatusLabel(COURSE_ORDER_STATUS_LABELS, enrollment.payment.status)} · {formatCourseMoney(enrollment.payment.amountVnd)}</p>}
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
                            <small>{getCourseStatusLabel(COURSE_DISPOSITION_LABELS, session.disposition)} · {getCourseStatusLabel(COURSE_ATTENDANCE_STATUS_LABELS, session.attendanceStatus)}</small>
                          </div>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="member-course-state">
                <h3>Bạn chưa đăng ký khóa học nào</h3>
                <p>Khám phá các khóa chuyên đề đang mở và chọn lịch phù hợp.</p>
              </div>
            )}
          </section>

          <MemberCourseWithdrawals enrollments={enrollments} onRequested={(enrollmentId) => {
            setEnrollments((items) => items.map((item) => item.enrollmentId === enrollmentId ? { ...item, lifecycleStatus: 'WITHDRAWAL_PENDING' } : item));
          }} />
          <MemberCourseRefunds enrollments={enrollments} />
          <CourseScheduleChanges enrollments={enrollments} onResponded={load} />
          <MemberCourseTransfers enrollments={enrollments} onTransferred={load} />
          <section className="member-course-section">
            <div className="member-course-section-title">
              <h2>Danh sách chờ</h2>
              <span>{activeWaitlists.length} yêu cầu</span>
            </div>
            {activeWaitlists.length ? (
              <div className="member-course-grid">
                {activeWaitlists.map((item) => {
                  const run = item;
                  return (
                    <article className="member-course-card" key={item.id}>
                      <div className="member-course-card-head">
                        <div>
                          <small>{run?.courseCode || 'Khóa học'} · {run?.runCode || 'Đợt học'}</small>
                          <h3>{run?.courseName || 'Thông tin khóa học'}</h3>
                        </div>
                        <span className={`member-course-status is-${item.status?.toLowerCase()}`}>
                          {getCourseStatusLabel(COURSE_WAITLIST_STATUS_LABELS, item.status)}
                        </span>
                      </div>
                      {item.status === 'WAITING' && <p>Vị trí hiện tại: <strong>#{item.position || '—'}</strong></p>}
                      {item.status === 'INVITED' && (
                        <p>Giữ chỗ đến {formatCourseDateTime(item.invitationExpiresAt)}.</p>
                      )}
                      <div className="member-course-actions">
                        {['INVITED', 'ACCEPTED'].includes(item.status) && (
                          <button type="button" disabled={!!busyId || (item.status === 'INVITED' && Date.parse(item.invitationExpiresAt) <= now)} onClick={() => handleAccept(item)}>
                            {item.status === 'ACCEPTED' ? 'Xem đơn thanh toán' : Date.parse(item.invitationExpiresAt) <= now ? 'Lời mời đã hết hạn' : 'Nhận chỗ và thanh toán'}
                          </button>
                        )}
                        {['WAITING', 'INVITED'].includes(item.status) && <button className="is-secondary" type="button" disabled={!!busyId} onClick={() => handleLeave(item)}>
                          Rời danh sách chờ
                        </button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="member-course-state"><p>Bạn không có yêu cầu chờ nào đang hoạt động.</p></div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
