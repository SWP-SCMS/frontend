import { Link, useParams, useSearchParams } from 'react-router-dom';
import useMyCourseEnrollments from './useMyCourseEnrollments';
import { isHistoricalCourse } from '../../../utils/courseHistory';
import MemberCourseEnrollmentDetail from './MemberCourseEnrollmentDetail';
import MemberCourseRefunds from './MemberCourseRefunds';
import MemberCourseWithdrawals from './MemberCourseWithdrawals';
import CourseScheduleChanges from './CourseScheduleChanges';
import MemberCourseTransfers from './MemberCourseTransfers';
import './MemberCoursesPage.css';

const titles = { detail: 'Chi tiết khóa đã đăng ký', refunds: 'Hoàn tiền khóa học', withdrawals: 'Rút khóa học', transfers: 'Chuyển đợt học', 'schedule-changes': 'Thay đổi lịch học' };
export default function MemberCourseWorkspacePage({ section }) {
  const { enrollmentId } = useParams();
  const [params, setParams] = useSearchParams();
  const selectedId = enrollmentId || params.get('enrollmentId') || '';
  const { enrollments, loading, error, reload } = useMyCourseEnrollments();
  const selected = enrollments.find(e => e.enrollmentId === selectedId);
  const scope = selectedId ? enrollments.filter(e => e.enrollmentId === selectedId) : enrollments;
  const returnToHistory = section === 'detail' && selected && isHistoricalCourse(selected);
  return <div className="member-course-page">
    <Link className="member-course-back" to={returnToHistory ? '/member/courses/history' : '/member/courses'}>← {returnToHistory ? 'Lịch sử khóa học' : 'Khóa học của tôi'}</Link>
    <header className="member-course-heading"><div><h1>{titles[section]}</h1>{selected && <p>{selected.courseName} · {selected.runCode}</p>}</div></header>
    {loading ? <p>Đang tải khóa học…</p> : error ? <div role="alert" className="member-course-alert">{error}<button className="btn btn-outline-secondary ms-2" onClick={() => reload()}>Thử lại</button></div> : selectedId && !selected ? <div className="member-course-state">Không tìm thấy khóa học trong tài khoản của bạn.</div> : <>
      {section !== 'detail' && <div className="mb-3"><label htmlFor="course-workspace-filter">Khóa học</label>
        <select id="course-workspace-filter" className="form-select mt-1" value={selectedId} onChange={e => setParams(e.target.value ? { enrollmentId: e.target.value } : {})}>
          <option value="">Tất cả khóa học</option>{enrollments.map(e => <option value={e.enrollmentId} key={e.enrollmentId}>{e.courseName} · {e.runCode}</option>)}
        </select>
      </div>}
      {section === 'detail' && selected && <>
        <MemberCourseEnrollmentDetail enrollment={selected} />
        <nav aria-label="Yêu cầu của khóa học" className="d-flex flex-wrap gap-2 mt-3">{Object.entries(titles).filter(([key]) => key !== 'detail').map(([key, title]) => <Link className="btn btn-outline-danger" key={key} to={`/member/courses/${key}?enrollmentId=${encodeURIComponent(selectedId)}`}>{title}</Link>)}</nav>
      </>}
      {section === 'withdrawals' && <MemberCourseWithdrawals key={selectedId} enrollments={scope} selectedEnrollmentId={selectedId} onRequested={() => reload()} />}
      {section === 'refunds' && <MemberCourseRefunds key={selectedId} enrollments={enrollments} selectedEnrollmentId={selectedId} />}
      {section === 'schedule-changes' && <CourseScheduleChanges key={selectedId} enrollments={scope} selectedEnrollmentId={selectedId} onResponded={() => reload()} />}
      {section === 'transfers' && <MemberCourseTransfers key={selectedId} enrollments={enrollments} selectedEnrollmentId={selectedId} onTransferred={() => reload()} />}
    </>}
  </div>;
}
