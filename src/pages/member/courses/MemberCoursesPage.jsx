import { Link, Navigate, useLocation } from 'react-router-dom';
import useMyCourseEnrollments from './useMyCourseEnrollments';
import { COURSE_ENROLLMENT_STATUS_LABELS, COURSE_RUN_STATUS_LABELS, getCourseStatusLabel } from '../../../utils/courseUi';
import { isHistoricalCourse } from '../../../utils/courseHistory';
import './MemberCoursesPage.css';

const oldSections = ['refunds', 'withdrawals', 'transfers', 'schedule-changes', 'waitlist'];
export default function MemberCoursesPage({ history = false }) {
  const { hash, search } = useLocation();
  const { enrollments, loading, error, reload } = useMyCourseEnrollments();
  const visibleEnrollments = enrollments.filter(e => isHistoricalCourse(e) === history);
  if (oldSections.includes(hash.slice(1))) return <Navigate replace to={`/member/courses/${hash.slice(1)}${search}`} />;
  return <div className="member-course-page">
    <header className="member-course-heading"><div><p className="member-course-eyebrow">Khóa học chuyên đề</p><h1>{history ? 'Lịch sử khóa học' : 'Khóa học của tôi'}</h1><p>{history ? 'Xem lại các khóa đã hoàn thành, đã rút, đã chuyển đợt hoặc bị hủy.' : 'Các khóa sắp học, đang học và đang chờ xử lý yêu cầu rút.'}</p></div><Link className="member-course-primary-link" to="/member/course-catalog">Khám phá khóa học</Link></header>
    <nav aria-label="Danh sách khóa học" className="d-flex gap-3 mb-3"><Link to="/member/courses" aria-current={!history ? 'page' : undefined}>Khóa học của tôi</Link><Link to="/member/courses/history" aria-current={history ? 'page' : undefined}>Lịch sử khóa học</Link></nav>
    <button className="btn btn-outline-secondary btn-sm" disabled={loading} onClick={() => reload()}>Tải lại dữ liệu</button>
    {error && <div className="member-course-alert" role="alert">{error}</div>}
    {loading ? <p>Đang tải khóa học…</p> : !error && <section className="member-course-section">
      <div className="member-course-section-title"><h2>{history ? 'Khóa học đã kết thúc' : 'Khóa học hiện tại'}</h2><span>{visibleEnrollments.length} khóa</span></div>
      {!visibleEnrollments.length ? <p>{history ? 'Bạn chưa có lịch sử khóa học.' : 'Bạn chưa có khóa học đang tham gia.'}</p> : <div className="member-course-grid">{visibleEnrollments.map(e => <article className="member-course-card" key={e.enrollmentId}>
        <small>{e.runCode}</small><h3>{e.courseName}</h3>
        <p>{e.lifecycleStatus === 'ACTIVE' && isHistoricalCourse(e) ? getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, e.courseRunStatus) : getCourseStatusLabel(COURSE_ENROLLMENT_STATUS_LABELS, e.lifecycleStatus)}</p>
        <p>Đã có mặt: {(e.sessions || []).filter(s => s.attendanceStatus === 'PRESENT').length}/{(e.sessions || []).length} buổi</p>
        {e.learningSuspended && <p>Tạm ngừng học trong khi chờ xử lý yêu cầu rút.</p>}
        <Link className="btn btn-outline-danger" to={`/member/courses/enrollments/${e.enrollmentId}`}>Xem chi tiết</Link>
      </article>)}</div>}
    </section>}
  </div>;
}
