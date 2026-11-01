import { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { listMyCourseRefunds } from '../../../services/courseReportingService';
import { formatCourseMoney, formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';
const statuses = { PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt, chưa ghi nhận chi', DISBURSEMENT_RECORDED: 'Đã ghi nhận chi, chờ xác minh', PENDING_VERIFICATION: 'Chờ xác minh', COMPLETED: 'Đã xác minh hoàn tất', REJECTED: 'Đã từ chối', FAILED: 'Thất bại', RETURNED: 'Khoản chi đã được trả lại' };
const sources = { MEMBER_WITHDRAWAL: 'Rút khóa học', COURSE_RUN_CANCELLED: 'Hủy đợt học', MATERIAL_CHANGE: 'Thay đổi đáng kể', UNRESOLVED_SESSIONS: 'Buổi học chưa xử lý', TRANSFER_CREDIT_EXCESS: 'Chênh lệch chuyển đợt', PAYMENT_EXCEPTION: 'Điều chỉnh thanh toán' };
const money = (value) => value == null ? 'Chưa xác định' : formatCourseMoney(value);
export default function MemberCourseRefunds({ enrollments }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    listMyCourseRefunds(page).then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getCourseErrorMessage(err, 'Không tải được khoản hoàn tiền.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, revision]);
  const names = new Map(enrollments.map((e) => [e.enrollmentId, `${e.courseName} · ${e.runCode}`]));
  return <section className="member-course-section" id="refunds">
    <h2>Hoàn tiền khóa học</h2>
    <p>Khoản đã duyệt, đã ghi nhận chi và đã xác minh là các bước khác nhau.</p>
    <Button variant="outline-secondary" disabled={loading} onClick={() => setRevision((v) => v + 1)}>Tải lại khoản hoàn</Button>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải…</p> : data && <>
      {!data.items?.length && <p>Không có khoản hoàn tiền trong trang này.</p>}
      {data.items?.map((item) => <article className="member-course-card mt-3" key={item.id}>
        <h3>{names.get(item.enrollmentId) || 'Khoản hoàn khóa học của bạn'}</h3>
        <p>{sources[item.source] || 'Hoàn tiền khóa học'} · {statuses[item.status] || 'Đang cập nhật'}</p>
        <dl><dt>Nghĩa vụ hoàn</dt><dd>{money(item.grossObligationVnd)}</dd>
          <dt>Đã duyệt</dt><dd>{money(item.approvedAmountVnd)}</dd>
          <dt>Đã ghi nhận chi</dt><dd>{money(item.disbursedAmountVnd)}</dd>
          <dt>Đã xác minh</dt><dd>{money(item.verifiedAmountVnd)}</dd></dl>
        <small>Cập nhật: {formatCourseDateTime(item.updatedAt)}</small>
      </article>)}
    </>}
    <div className="d-flex gap-2 mt-3"><Button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button>
      <span>Trang {page + 1}</span><Button disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
  </section>;
}
