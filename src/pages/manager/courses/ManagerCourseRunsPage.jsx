import CourseRunStatusBadge from '../../../components/common/CourseRunStatusBadge';
import WeeklyCourseRunModal from './WeeklyCourseRunModal';
import { listRooms } from '../../../services/roomService';
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
import { searchStaffAccounts } from "../../../services/staffAccountService";
import {
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorMessage,
} from "../../../utils/courseUi";

export default function ManagerCourseRunsPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [] });
  const [courses, setCourses] = useState([]);
  const [coaches, setCoaches] = useState([]);
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
        const [roomList, runPage, coursePage, coachPage] = await Promise.all([
          listRooms(),
          listManagerCourseRuns({ page, size: 20 }),
          listManagerCourses({ page: 0, size: 100 }),
          searchStaffAccounts({
            role: "COACH",
            status: "ACTIVE",
            page: 0,
            size: 100,
          }),
        ]);
        commitValue(setRooms, roomList);
        commitValue(setResult, runPage);
        commitValue(setCourses, coursePage.content || []);
        commitValue(setCoaches, coachPage?.content || []);
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
      setters: [setResult, setCourses, setCoaches, setRooms],
      setLoading,
    },
    !showCreate,
  );

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-start mb-4">
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
      <div className="bg-white rounded shadow-sm p-3">
        {loading ? (
          <div className="text-center py-5">
            <Spinner />
          </div>
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Mã đợt</th>
                <th>Khóa học</th>
                <th>Huấn luyện viên</th>
                <th>Học phí</th>
                <th>Khai giảng</th>
                <th>Trạng thái</th>
                <th />
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
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={page === 0 || loading}
            onClick={() => setPage((v) => v - 1)}
          >
            Trang trước
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={result.last || loading}
            onClick={() => setPage((v) => v + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>

      {showCreate && <WeeklyCourseRunModal courses={courses} coaches={coaches} rooms={rooms}
        onClose={() => setShowCreate(false)} onCreated={run => navigate(`/manager/course-runs/${run.id}`)} />}

    </div>
  );
}
