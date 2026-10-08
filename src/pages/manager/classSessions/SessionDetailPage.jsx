// Manager – Session detail (US29).
//
// Read-only view of a single Class Session. Loads via the dedicated
// GET /api/v1/manager/class-sessions/{id} endpoint.
//
// ClassSessionDetailResponse (server-resolved labels; no client-side
// listClasses / listRooms / searchStaffAccounts lookups on this page):
//   { id, classId, className, classType, disciplineId, disciplineName,
//     coachId, coachName, roomId, roomName, roomCapacity,
//     recurringScheduleId, startTime, endTime, capacity, status,
//     cancelledAt, cancellationReason, createdBy,
//     canUpdateAssignment, canCancel }
//
// bookedCount is intentionally NOT rendered: the verified detail DTO
// does not include it. canUpdateAssignment / canCancel are ignored —
// US29 is read-only.

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getManagerSessionDetail } from '../../../services/classSessionService';

const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const STATUS_BADGE = {
  SCHEDULED: 'bg-primary-subtle text-primary-emphasis',
  IN_PROGRESS: 'bg-warning-subtle text-warning-emphasis',
  COMPLETED: 'bg-success-subtle text-success-emphasis',
  CANCELLED: 'bg-secondary-subtle text-secondary-emphasis',
};

const STATUS_LABEL = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

// ----- Asia/Ho_Chi_Minh helpers (page-local; same convention as US28) -----

function formatGymDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatGymTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatGymDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatGymDate(iso)} · ${formatGymTime(iso)}`;
}

// Safe internal-only back target. Accepts only paths that start with
// /manager/class-sessions to avoid ever navigating to an arbitrary URL.
function resolveBackTarget(state) {
  const from = state && typeof state.from === 'string' ? state.from : null;
  if (from && from.startsWith('/manager/class-sessions')) {
    return from;
  }
  return '/manager/class-sessions';
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const backTarget = resolveBackTarget(location.state);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getManagerSessionDetail(sessionId);
      setSession(data);
    } catch (err) {
      setSession(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

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

  if (error || !session) {
    return (
      <div>
        <Link to={backTarget} className="small text-decoration-none">
          ← Quay lại Buổi tập
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được buổi tập"
        />
      </div>
    );
  }

  const status = session.status || '';
  const typeLabel = TYPE_LABEL[session.classType] || session.classType || '—';
  const isCancelled = status === 'CANCELLED';

  return (
    <div>
      <Link to={backTarget} className="small text-decoration-none">
        ← Quay lại Buổi tập
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">
            {session.className || '—'}
          </h1>
          <p className="text-muted mb-1">Buổi tập</p>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span
              className={`badge ${STATUS_BADGE[status] || 'bg-light text-dark'}`}
            >
              {STATUS_LABEL[status] || status || '—'}
            </span>
            <span className="text-muted small">
              {formatGymDate(session.startTime)} ·{' '}
              {formatGymTime(session.startTime)} –{' '}
              {formatGymTime(session.endTime)}
            </span>
          </div>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Ngày</h2>
              <p className="mb-2 fw-semibold">
                {formatGymDate(session.startTime)}
              </p>
              <h2 className="h6 text-uppercase text-muted">Giờ</h2>
              <p className="mb-0 fw-semibold">
                {formatGymTime(session.startTime)} –{' '}
                {formatGymTime(session.endTime)}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">
                Huấn luyện viên
              </h2>
              <p className="mb-0 fw-semibold">
                {session.coachName || '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Phòng tập</h2>
              <p className="mb-1 fw-semibold">
                {session.roomName || '—'}
              </p>
              <p className="text-muted small mb-0">
                Sức chứa phòng:{' '}
                {typeof session.roomCapacity === 'number'
                  ? session.roomCapacity
                  : '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">
                Sức chứa buổi tập
              </h2>
              <p className="mb-0 fw-semibold">
                {typeof session.capacity === 'number'
                  ? session.capacity
                  : '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Bộ môn</h2>
              {session.disciplineId ? (
                <Link
                  to={`/manager/disciplines/${session.disciplineId}`}
                  className="fw-semibold text-decoration-none"
                >
                  {session.disciplineName || '—'}
                </Link>
              ) : (
                <span className="fw-semibold">
                  {session.disciplineName || '—'}
                </span>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Loại lớp</h2>
              <p className="mb-0 fw-semibold">{typeLabel}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {isCancelled ? (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <h2 className="h6 text-uppercase text-muted">Huỷ</h2>
            <p className="mb-2 small text-muted">
              Thời điểm huỷ: {formatGymDateTime(session.cancelledAt)}
            </p>
            <h2 className="h6 text-uppercase text-muted">Lý do huỷ</h2>
            <p
              className="mb-0"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {session.cancellationReason
                ? session.cancellationReason
                : '—'}
            </p>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  );
}
