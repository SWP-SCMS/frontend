import StaffPagination from '../../../components/common/StaffPagination';
import Badge from '../../../components/common/SystemBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { listMyCourseRefunds } from '../../../services/courseReportingService';
import { formatCourseMoney, formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';
import { COURSE_REFUND_STATUS_LABELS as statuses, COURSE_REFUND_SOURCE_LABELS as sources } from '../../../utils/courseWorkflow';
import './MemberCourseRefunds.css';
const money = (value) => value == null ? 'Chưa xác định' : formatCourseMoney(value);
export default function MemberCourseRefunds({ enrollments, selectedEnrollmentId = '' }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, ''); if (!background) commitValue(setData, null);
    track(listMyCourseRefunds(page).then((result) => { if (active) commitValue(setData, result); })
      .catch((err) => { failed(err);  if (active) commitError(setError, getCourseErrorMessage(err, 'Không tải được khoản hoàn tiền.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [page, revision]);
  const visibleItems = (data?.items || []).filter(item => !selectedEnrollmentId || item.enrollmentId === selectedEnrollmentId);
  const names = new Map(enrollments.map((e) => [e.enrollmentId, `${e.courseName} · ${e.runCode}`]));
  return <section className="member-course-section member-course-refunds" id="refunds">
    <div className="member-course-refunds-toolbar">
      <h2>Hoàn tiền khóa học</h2>
      <Button size="sm" variant="outline-secondary" disabled={loading} onClick={() => setRevision((v) => v + 1)}>Tải lại khoản hoàn</Button>
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải…</p> : data && <>
      {!visibleItems.length && <p>Không có khoản hoàn tiền trong trang này.</p>}
      {visibleItems.map((item) => <article className="member-course-refund-card" key={item.id}>
        <header>
          <div><h3>{names.get(item.enrollmentId) || 'Khoản hoàn khóa học của bạn'}</h3>
            <p>{sources[item.source] || 'Hoàn tiền khóa học'}</p></div>
          <Badge>{statuses[item.status] || 'Đang cập nhật'}</Badge>
        </header>
        <dl className="member-course-refund-amounts">
          <div><dt>Số tiền cần hoàn</dt><dd>{money(item.grossObligationVnd)}</dd></div>
          <div><dt>Đã duyệt</dt><dd>{money(item.approvedAmountVnd)}</dd></div>
          <div><dt>Đã ghi nhận chi</dt><dd>{money(item.disbursedAmountVnd)}</dd></div>
          <div><dt>Đã xác minh</dt><dd>{money(item.verifiedAmountVnd)}</dd></div>
        </dl>
        <footer>Cập nhật: {formatCourseDateTime(item.updatedAt)}</footer>
      </article>)}
    </>}
    <StaffPagination page={page} totalPages={data?.totalPages} loading={loading || !data} onPageChange={setPage} />
  </section>;
}
