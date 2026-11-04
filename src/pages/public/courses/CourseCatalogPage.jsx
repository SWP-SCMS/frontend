import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import CourseCatalogLayout from '../../../components/layout/CourseCatalogLayout';
import { listCatalogCourses } from '../../../services/courseCatalogService';
import './CourseCatalogPage.css';

function CourseCard({ course, memberView }) {
  return (
    <article className="course-card">
      <div className="course-card-media">
        {course.imageUrl ? (
          <img src={course.imageUrl} alt="" />
        ) : (
          <span>{course.name?.charAt(0)?.toUpperCase() || 'C'}</span>
        )}
      </div>
      <div className="course-card-body">
        <div className="course-card-meta">
          <span>{course.disciplineName || 'Chuyên đề'}</span>
          <small>{course.code}</small>
        </div>
        <h2>{course.name}</h2>
        <p>{course.description || 'Thông tin chi tiết đang được cập nhật.'}</p>
        <Link className="course-primary-link" to={`${memberView ? "/member/course-catalog" : "/courses"}/${course.id}`}>
          Xem khóa học
        </Link>
      </div>
    </article>
  );
}

export default function CourseCatalogPage({ memberView = false }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    commitError(setError, false);
    try {
      const page = await listCatalogCourses({ page: 0, size: 100 });
      commitValue(setCourses, page.content || []);
    } catch { failed();
      commitError(setError, true);
    } finally {
      if (!background) commitValue(setLoading, false);
    }
  }, []);

  useCachedPollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(load({ background, commitValue, commitError, failed }));
  }, [load], { key: ['course-catalog'], setters: [setCourses], setLoading });

  return (
    <CourseCatalogLayout memberView={memberView}>
      <section className="course-hero">
        <div className="scms-home-wrap">
          <span className="scms-home-eyebrow">Chương trình chuyên đề</span>
          <h1>Khóa học tại SCMS</h1>
          <p>
            Theo dõi lịch khai giảng, huấn luyện viên và toàn bộ nội dung từng
            đợt học trước khi đăng ký.
          </p>
        </div>
      </section>

      <section className="course-section">
        <div className="scms-home-wrap">
          {loading ? (
            <div className="course-grid" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div className="course-card course-skeleton" key={item} />
              ))}
            </div>
          ) : error ? (
            <div className="course-state">
              <h2>Không tải được danh sách khóa học</h2>
              <p>Vui lòng thử lại sau ít phút.</p>
              <button type="button" onClick={load}>Thử lại</button>
            </div>
          ) : courses.length === 0 ? (
            <div className="course-state">
              <h2>Chưa có khóa học nào được công bố</h2>
              <p>Các chương trình mới sẽ xuất hiện tại đây khi sẵn sàng.</p>
            </div>
          ) : (
            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard memberView={memberView} course={course} key={course.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </CourseCatalogLayout>
  );
}
