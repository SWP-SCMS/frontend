import Badge from '../../../components/common/SystemBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CourseCatalogLayout from '../../../components/layout/CourseCatalogLayout';
import { ROLES } from '../../../constants';
import { useAuth } from '../../../context/useAuth';
import { getCatalogCourseRun } from '../../../services/courseCatalogService';
import {
  COURSE_REGISTRATION_STATUS_LABELS,
  effectiveCourseSessions,
  COURSE_SESSION_STATUS_LABELS,
  formatCourseDateTime,
  formatCourseMoney,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './CourseCatalogPage.css';

export default function CourseRunDetailPage({ memberView = false }) {
  const { runId } = useParams();
  const { isAuthenticated, role } = useAuth();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    commitError(setError, false);
    try {
      commitValue(setRun, await getCatalogCourseRun(runId));
    } catch { failed();
      commitError(setError, true);
    } finally {
      if (!background) commitValue(setLoading, false);
    }
  }, [runId]);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(load({ background, commitValue, commitError, failed }));
  }, [load]);

  return (
    <CourseCatalogLayout memberView={memberView}>
      <section className="course-section course-detail-section">
        <div className="scms-home-wrap">
          <Link className="course-back-link" to={`${memberView ? "/member/course-catalog" : "/courses"}${run?.courseId ? `/${run.courseId}` : ""}`}>
            ← Quay lại khóa học
          </Link>
          {loading ? (
            <div className="course-state"><p>Đang tải đợt học…</p></div>
          ) : error || !run ? (
            <div className="course-state"><h1>Không tải được đợt học</h1><button type="button" onClick={load}>Thử lại</button></div>
          ) : (
            <>
              <div className="course-detail-hero run-detail-hero">
                <div>
                  <span className="scms-home-eyebrow">{run.courseCode} · {run.runCode}</span>
                  <h1>{run.courseName}</h1>
                  <Badge className={`course-status is-${run.registrationStatus?.toLowerCase()}`}>
                    {getCourseStatusLabel(COURSE_REGISTRATION_STATUS_LABELS, run.registrationStatus)}
                  </Badge>
                </div>
                <div className="course-price-box"><small>Học phí</small><strong>{formatCourseMoney(run.tuitionVnd)}</strong></div>
              </div>

              <dl className="course-facts">
                <div><dt>Huấn luyện viên</dt><dd>{run.primaryCoachName || 'Đang cập nhật'}</dd></div>
                <div><dt>Thời gian học</dt><dd>{formatCourseDateTime(run.plannedStartAt)} – {formatCourseDateTime(run.plannedEndAt)}</dd></div>
                <div><dt>Thời gian đăng ký</dt><dd>{formatCourseDateTime(run.registrationOpensAt)} – {formatCourseDateTime(run.registrationClosesAt)}</dd></div>
                <div><dt>Quy mô lớp</dt><dd>Tối đa {run.capacity} học viên</dd></div>
                <div><dt>Số buổi</dt><dd>{run.totalUnits ?? '—'} buổi</dd></div>
              </dl>

              {run.registrationStatus === 'OPEN' && (!isAuthenticated || role === ROLES.MEMBER) ? (
                <div className="course-run-action">
                  <Link
                    className="course-primary-link"
                    to={isAuthenticated ? `/member/courses/${runId}/register` : '/login'}
                  >
                    {isAuthenticated ? 'Đăng ký khóa học' : 'Đăng nhập để đăng ký'}
                  </Link>
                </div>
              ) : null}

              <div className="course-title-row"><div><span className="scms-home-eyebrow">Nội dung khóa</span><h2>Lịch học dự kiến</h2></div></div>
              {effectiveCourseSessions(run.sessions).length ? (
                <div className="course-session-list">
                  {effectiveCourseSessions(run.sessions).sort((a, b) => a.unitNumber - b.unitNumber).map((session) => (
                    <article className="course-session" key={session.id}>
                      <span className="course-session-unit">Buổi {session.unitNumber}</span>
                      <div><strong>{formatCourseDateTime(session.startAt)}</strong><p>{session.roomName || 'Phòng đang cập nhật'} · {session.coachName || run.primaryCoachName || 'HLV đang cập nhật'}</p></div>
                      <Badge className="course-session-status">{getCourseStatusLabel(COURSE_SESSION_STATUS_LABELS, session.status)}</Badge>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="course-state"><p>Lịch học chi tiết đang được cập nhật.</p></div>
              )}
            </>
          )}
        </div>
      </section>
    </CourseCatalogLayout>
  );
}
