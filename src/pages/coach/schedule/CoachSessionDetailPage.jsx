// /coach/schedule/:sessionId — chi tiết một buổi dạy, có 2 nút đi tới
// danh sách học viên và điểm danh.

import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import SessionSummary from './SessionSummary';
import { useCoachSession } from './useCoachSession';
import './CoachSchedulePage.css';

export default function CoachSessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, loading, error, setError } = useCoachSession(sessionId);

  // Quay lại đúng tuần đang xem (?week=...) nếu có lịch sử, không thì về lịch.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/coach/schedule');
  }

  return (
    <div className="scms-coach-page">
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
            <Button variant="outline-secondary" onClick={goBack}>
              Quay lại lịch
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
