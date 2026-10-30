import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCatalogCourseRuns } from '../../../services/courseCatalogService';
import { listMyCourseEnrollments } from '../../../services/courseEnrollmentService';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import {
  acceptCourseWaitlistInvitation,
  leaveCourseWaitlist,
  listMyCourseWaitlists,
} from '../../../services/courseWaitlistService';
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  COURSE_WAITLIST_STATUS_LABELS,
  formatCourseDateTime,
  getCourseErrorMessage,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './MemberCoursesPage.css';

const ACTIVE_WAITLIST_STATUSES = new Set(['WAITING', 'INVITED']);

export default function MemberCoursesPage() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [enrollmentData, waitlistData, runData] = await Promise.all([
        listMyCourseEnrollments(),
        listMyCourseWaitlists(),
        listCatalogCourseRuns({ size: 100 }),
      ]);
      setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
      setWaitlists(Array.isArray(waitlistData) ? waitlistData : []);
      setRuns(runData?.content || []);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không tải được thông tin khóa học của bạn.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runById = useMemo(
    () => new Map(runs.map((run) => [String(run.id || run.runId), run])),
    [runs],
  );

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
        createCourseIdempotencyKey('course-waitlist-accept'),
      );
      navigate(`/member/courses/${item.courseRunId}/register?orderId=${order.orderId}`);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể nhận chỗ được mời.'));
    } finally {
      setBusyId('');
    }
  }

  const activeWaitlists = waitlists.filter((item) => ACTIVE_WAITLIST_STATUSES.has(item.status));

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
                      <span className="member-course-status is-success">Đã đăng ký</span>
                    </div>
                    <p>Đăng ký lúc {formatCourseDateTime(enrollment.enrolledAt)}</p>
                    <div className="member-course-session-stack">
                      {[...(enrollment.sessions || [])]
                        .sort((a, b) => a.unitNumber - b.unitNumber)
                        .map((session) => (
                          <div className="member-course-session-row" key={session.enrollmentSessionId}>
                            <strong>Buổi {session.unitNumber}</strong>
                            <span>{formatCourseDateTime(session.startAt)}</span>
                            <small>{getCourseStatusLabel(COURSE_ATTENDANCE_STATUS_LABELS, session.attendanceStatus)}</small>
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

          <section className="member-course-section">
            <div className="member-course-section-title">
              <h2>Danh sách chờ</h2>
              <span>{activeWaitlists.length} yêu cầu</span>
            </div>
            {activeWaitlists.length ? (
              <div className="member-course-grid">
                {activeWaitlists.map((item) => {
                  const run = runById.get(String(item.courseRunId));
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
                        {item.status === 'INVITED' && (
                          <button type="button" disabled={busyId === item.id} onClick={() => handleAccept(item)}>
                            Nhận chỗ và thanh toán
                          </button>
                        )}
                        <button className="is-secondary" type="button" disabled={busyId === item.id} onClick={() => handleLeave(item)}>
                          Rời danh sách chờ
                        </button>
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
