// /coach/schedule/:sessionId — chi tiết một buổi dạy, có 2 nút đi tới
// danh sách học viên và điểm danh.

import { Link, useParams } from 'react-router-dom';
import { Button, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import { getGymLocalIsoDate } from '../../../utils/gymTime';
import SessionSummary from './SessionSummary';
import { useCoachSession } from './useCoachSession';
import './CoachSchedulePage.css';

export default function CoachSessionDetailPage() {
  const { sessionId } = useParams();
  const { session, loading, error, setError } = useCoachSession(sessionId);

  const schedulePath = session?.startTime
    ? `/coach/schedule?week=${getGymLocalIsoDate(session.startTime)}`
    : '/coach/schedule';

  return (
    <div className="scms-coach-page">
      {session ? (
        <WorkflowBreadcrumb
          items={[{ to: schedulePath, label: 'Lịch phụ trách' }]}
          current={session.className || 'Chi tiết buổi tập'}
        />
      ) : null}
      <h1 className="h3 fw-bold mb-3">Chi tiết buổi tập</h1>

      <ErrorAlert
        error={error}
        title="Không tải được buổi tập"
        onClose={() => setError(null)}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" size="sm" /> Đang tải...
        </div>
      ) : session ? (
        <>
          <SessionSummary session={session} />
          <div className="d-flex flex-wrap gap-2">
            <Button
              as={Link}
              to={`/coach/schedule/${sessionId}/students`}
              variant="danger"
            >
              Danh sách học viên
            </Button>
            <Button
              as={Link}
              to={`/coach/schedule/${sessionId}/attendance`}
              variant="outline-danger"
              disabled={session.status === 'CANCELLED'}
            >
              Điểm danh
            </Button>
            <Button as={Link} to={schedulePath} variant="outline-secondary">
              Quay lại lịch
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
