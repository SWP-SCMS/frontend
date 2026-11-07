import StaffPagination from '../../../components/common/StaffPagination';
import CourseRunStatusBadge from '../../../components/common/CourseRunStatusBadge';
import WeeklyCourseRunModal from './WeeklyCourseRunModal';
import useCachedPollingEffect from "../../../hooks/useCachedPollingEffect";
import { useCallback, useState } from "react";
import {
  Button,
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
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorMessage,
} from "../../../utils/courseUi";

export default function ManagerCourseRunsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [] });
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
          listManagerCourseRuns({ page, size: 20 }),
          listManagerCourses({ page: 0, size: 100 }),
        ]);
        commitValue(setResult, runPage);
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
    [page],
  );
  useCachedPollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      track(load({ background, commitValue, commitError, failed }));
    },
    [load],
    {
      key: ["manager-runs", page],
      setters: [setResult, setCourses],
      setLoading,
    },
    !showCreate,
  );

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
              {result.content.map((run) => (
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
              {!result.content.length && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    Chưa có đợt mở khóa học.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
        <StaffPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} />
      </div>

      {showCreate && <WeeklyCourseRunModal courses={courses}
        onClose={() => setShowCreate(false)} onCreated={run => navigate(`/manager/course-runs/${run.id}`)} />}

    </div>
  );
}
