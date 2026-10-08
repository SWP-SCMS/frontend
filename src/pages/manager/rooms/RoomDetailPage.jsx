// Manager – Room detail (US25).
//
// Read-only view of a single room. Loads via the dedicated
// GET /api/v1/manager/rooms/{roomId} endpoint.
//
// RoomResponse exposes exactly these fields today:
//   { id, name, capacity, status }
// createdAt / updatedAt / version are NOT in the response DTO.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getRoom } from '../../../services/roomService';

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoom(roomId);
      setRoom(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div>
        <Link
          to="/manager/rooms"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được phòng"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/manager/rooms"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{room.name || '—'}</h1>
          <p className="text-muted mb-0">Phòng tập</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/rooms/${room.id}/edit`}
            variant="outline-danger"
          >
            Chỉnh sửa
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Sức chứa</h2>
              <p className="mb-0 fw-semibold">
                {room.capacity != null ? room.capacity : '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Trạng thái</h2>
              <p className="mb-1">
                <span
                  className={`badge ${
                    STATUS_BADGE[room.status] || 'bg-light text-dark'
                  }`}
                >
                  {room.status || '—'}
                </span>
              </p>
              {room.status === 'INACTIVE' ? (
                <p className="text-muted small mb-0">
                  Đã ngưng hoạt động — vẫn có thể kích hoạt lại qua
                  trang Chỉnh sửa.
                </p>
              ) : null}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
