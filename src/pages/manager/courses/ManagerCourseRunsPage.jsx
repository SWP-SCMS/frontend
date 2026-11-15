import StaffPagination from '../../../components/common/StaffPagination';
import CourseRunStatusBadge from '../../../components/common/CourseRunStatusBadge';
import WeeklyCourseRunModal from './WeeklyCourseRunModal';
import useCachedPollingEffect from "../../../hooks/useCachedPollingEffect";
import { useCallback, useState } from "react";
import {
  Button,
  Form,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import ErrorAlert from "../../../components/common/ErrorAlert";
import {
  listManagerCourseRuns,
  listManagerCourses,
} from "../../../services/courseAdminService";
import {
  COURSE_RUN_STATUS_LABELS,
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorMessage,
} from "../../../utils/courseUi";

export default function ManagerCourseRunsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [runs, setRuns] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const load = useCallback(
    async ({
      background = false,
      commitValue = (setter, value) => setter(value),
      commitError = (setter, value) => setter(value),
      failed = () => {},
    } = {}) => {
      if (!background) commitValue(setLoading, true);
      commitError(setError, "");
      try {
        const [runPage, coursePage] = await Promise.all([
          listManagerCourseRuns({ page: 0, size: 100 }),
          listManagerCourses({ page: 0, size: 100 }),
        ]);
        const allRuns = [...runPage.content];
        for (let next = 1; next < runPage.totalPages; next++) {
          const batch = await listManagerCourseRuns({ page: next, size: 100 });
          allRuns.push(...batch.content);
        }
        commitValue(setRuns, allRuns);
        commitValue(setCourses, coursePage.content || []);
      } catch (err) {
        failed(err);
        commitError(
          setError,
          getCourseErrorMessage(
            err,
            "Không tải được danh sách đợt mở khóa học.",
          ),
        );
      } finally {
        if (!background) commitValue(setLoading, false);
      }
    },
    [],
  );
  useCachedPollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      track(load({ background, commitValue, commitError, failed }));
    },
    [load],
    {
      key: ["manager-runs", "all"],
      setters: [setRuns, setCourses],
      setLoading,
    },
    !showCreate,
  );

  const courseOptions = Array.from(new Map(runs.map(run => [run.courseId, run.courseName])))
    .sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const filtered = runs.filter(run =>
    (!courseId || run.courseId === courseId) && (!status || run.status === status));
  const pageSize = 20;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const visiblePage = Math.min(page, Math.max(0, totalPages - 1));
  const visible = filtered.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize);

  return (
    <div className="scms-course-workspace">
      <div className="scms-course-header">
        <div>
          <h1 className="h3 mb-1">Đợt mở khóa học</h1>
          <p className="text-muted mb-0">
            Thiết lập thời gian, học phí, sĩ số và huấn luyện viên cho từng đợt.
          </p>
        </div>
        <Button variant="danger" disabled={loading} onClick={() => setShowCreate(true)}>
          + Tạo đợt mở
        </Button>
      </div>
      <div className="row g-3 mb-3">
        <Form.Group controlId="run-filter-course" className="col-md-4">
          <Form.Label>Khóa học</Form.Label>
          <Form.Select value={courseId} onChange={event => { setCourseId(event.target.value); setPage(0); }}>
            <option value="">Tất cả khóa học</option>
            {courseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group controlId="run-filter-status" className="col-md-3">
          <Form.Label>Trạng thái</Form.Label>
          <Form.Select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(COURSE_RUN_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Form.Select>
        </Form.Group>
      </div>
      {error && (
        <ErrorAlert
          error={error}
          title="Không thể xử lý đợt mở khóa học"
          onClose={() => setError("")}
        />
      )}
      <div className="card border-0 shadow-sm">
        {loading ? (
          <div className="text-center py-5">
            <Spinner />
          </div>
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Mã đợt</th>
                <th>Khóa học</th>
                <th>Huấn luyện viên</th>
                <th>Học phí</th>
                <th>Khai giảng</th>
                <th>Trạng thái</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((run) => (
                <tr key={run.id}>
                  <td>{run.runCode}</td>
                  <td>{run.courseName}</td>
                  <td>{run.primaryCoachName}</td>
                  <td>{formatCourseMoney(run.tuitionVnd)}</td>
                  <td>{formatCourseDateTime(run.plannedStartAt)}</td>
                  <td>
                    <CourseRunStatusBadge status={run.status} />
                  </td>
                  <td className="text-end">
                    <Button
                      as={Link}
                      to={`/manager/course-runs/${run.id}`}
                      size="sm"
                      variant="outline-danger"
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    {courseId || status ? "Không có đợt học phù hợp với bộ lọc." : "Chưa có đợt mở khóa học."}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
        <StaffPagination page={visiblePage} totalPages={totalPages} totalElements={filtered.length} loading={loading} onPageChange={setPage} />
      </div>

      {showCreate && <WeeklyCourseRunModal courses={courses}
        onClose={() => setShowCreate(false)} onCreated={run => navigate(`/manager/course-runs/${run.id}`)} />}

    </div>
  );
}
