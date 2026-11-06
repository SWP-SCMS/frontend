import Badge from '../../../components/common/SystemBadge';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CourseCatalogLayout from '../../../components/layout/CourseCatalogLayout';
import {
  getCatalogCourse,
  listCatalogCourseRuns,
} from '../../../services/courseCatalogService';
import {
  COURSE_REGISTRATION_STATUS_LABELS,
  formatCourseDateTime,
  formatCourseMoney,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './CourseCatalogPage.css';

function RunCard({ run, memberView }) {
  const registrationLabel = getCourseStatusLabel(
    COURSE_REGISTRATION_STATUS_LABELS,
    run.registrationStatus,
  );

  return (
    <article className="course-run-card">
      <div className="course-run-card-head">
        <div>
          <small>{run.runCode}</small>
          <h3>{run.courseName}</h3>
        </div>
        <Badge className={`course-status is-${run.registrationStatus?.toLowerCase()}`}>
          {registrationLabel}
        </Badge>
      </div>
      <dl className="course-facts compact">
        <div><dt>Khai giảng</dt><dd>{formatCourseDateTime(run.plannedStartAt)}</dd></div>
        <div><dt>Huấn luyện viên</dt><dd>{run.primaryCoachName || 'Đang cập nhật'}</dd></div>
        <div><dt>Số buổi</dt><dd>{run.totalUnits ?? '—'}</dd></div>
        <div><dt>Học phí</dt><dd>{formatCourseMoney(run.tuitionVnd)}</dd></div>
      </dl>
      <Link className="course-primary-link" to={`${memberView ? "/member/course-runs" : "/course-runs"}/${run.id}`}>
        Xem đợt học
      </Link>
    </article>
  );
}

export default function CourseDetailPage({ memberView = false }) {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    commitError(setError, false);
    try {
      const [courseData, runPage] = await Promise.all([
        getCatalogCourse(courseId),
        listCatalogCourseRuns({ page: 0, size: 100 }),
      ]);
      commitValue(setCourse, courseData);
      commitValue(setRuns, (runPage.content || []).filter((run) => String(run.courseId) === String(courseId)));
    } catch { failed();
      commitError(setError, true);
    } finally {
      if (!background) commitValue(setLoading, false);
    }
  }, [courseId]);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(load({ background, commitValue, commitError, failed }));
  }, [load]);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(a.plannedStartAt) - new Date(b.plannedStartAt)),
    [runs],
  );

  return (
    <CourseCatalogLayout memberView={memberView}>
      <section className="course-section course-detail-section">
        <div className="scms-home-wrap">
          <Link className="course-back-link" to={memberView ? "/member/course-catalog" : "/courses"}>← Tất cả khóa học</Link>
          {loading ? (
            <div className="course-state"><p>Đang tải khóa học…</p></div>
          ) : error || !course ? (
            <div className="course-state">
              <h1>Không tải được khóa học</h1>
              <button type="button" onClick={load}>Thử lại</button>
            </div>
          ) : (
            <>
              <div className="course-detail-hero">
                <div>
                  <span className="scms-home-eyebrow">{course.disciplineName || 'Khóa học'}</span>
                  <h1>{course.name}</h1>
                  <p>{course.description || 'Thông tin khóa học đang được cập nhật.'}</p>
                </div>
                <div className="course-code-box"><small>Mã khóa học</small><strong>{course.code}</strong></div>
              </div>

              <div className="course-title-row">
                <div><span className="scms-home-eyebrow">Lịch mở lớp</span><h2>Các đợt học</h2></div>
                <p>{sortedRuns.length} đợt học</p>
              </div>
              {sortedRuns.length === 0 ? (
                <div className="course-state"><h3>Chưa có đợt học đang công bố</h3><p>Vui lòng quay lại sau.</p></div>
              ) : (
                <div className="course-run-grid">
                  {sortedRuns.map((run) => <RunCard memberView={memberView} run={run} key={run.id} />)}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </CourseCatalogLayout>
  );
}
