// Hộp thông tin một buổi dạy, mở ngay trên trang lịch khi bấm vào thẻ buổi tập
// (không chuyển trang). Hai nút bên dưới đi tới trang danh sách học viên và
// trang điểm danh (React Router).

import { Link } from 'react-router-dom';
import { Button, Modal, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import SessionSummary from './SessionSummary';
import { useCoachSession } from './useCoachSession';
import './CoachSchedulePage.css';

export default function CoachSessionInfoModal({ sessionId, onHide }) {
  const { session, loading, error, setError } = useCoachSession(sessionId);

  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Thông tin buổi tập</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ErrorAlert
          error={error}
          title="Không tải được buổi tập"
          onClose={() => setError(null)}
        />
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" /> Đang tải...
          </div>
        ) : session ? (
          <SessionSummary session={session} bare />
        ) : null}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Button variant="outline-secondary" onClick={onHide}>
          Đóng
        </Button>
        <div className="d-flex gap-2">
          <Button
            as={Link}
            to={`/coach/schedule/${sessionId}/students`}
            variant="danger"
            disabled={!session}
          >
            Danh sách học viên
          </Button>
          <Button
            as={Link}
            to={`/coach/schedule/${sessionId}/attendance`}
            variant="outline-danger"
            disabled={!session || session.status === 'CANCELLED'}
          >
            Điểm danh
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
