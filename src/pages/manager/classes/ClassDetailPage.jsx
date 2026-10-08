// Manager – Class detail (US24).
//
// Read-only view of a single class. Loads via the dedicated
// GET /api/v1/manager/classes/{classId} endpoint.
//
// SportClassResponse exposes exactly these fields today:
//   { id, disciplineId, disciplineName, name, classType,
//     description, status }
// createdAt / updatedAt / version / coach / room / schedule /
// capacity / price are NOT in the response DTO and are NOT rendered
// here (per audit §D.1, §D.5 / plan §L).

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getClass } from '../../../services/sportClassService';

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

export default function ClassDetailPage() {
  const { classId } = useParams();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClass(classId);
      setClassData(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

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

  if (error || !classData) {
    return (
      <div>
        <Link
          to="/manager/classes"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được lớp"
        />
      </div>
    );
  }

  const typeLabel = TYPE_LABEL[classData.classType] || classData.classType || '—';

  return (
    <div>
      <Link
        to="/manager/classes"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{classData.name || '—'}</h1>
          <p className="text-muted mb-0">Lớp đào tạo</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/classes/${classData.id}/sessions/new`}
            variant="danger"
            disabled={classData.status !== 'ACTIVE'}
          >
            Tạo buổi tập
          </Button>
          <Button
            as={Link}
            to={`/manager/classes/${classData.id}/recurring-schedules/new`}
            variant="danger"
            disabled={classData.status !== 'ACTIVE'}
          >
            Tạo lịch cố định
          </Button>
          <Button
            as={Link}
            to={`/manager/classes/${classData.id}/edit`}
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
              <h2 className="h6 text-uppercase text-muted">Loại</h2>
              <p className="mb-0 fw-semibold">{typeLabel}</p>
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
                    STATUS_BADGE[classData.status] || 'bg-light text-dark'
                  }`}
                >
                  {classData.status || '—'}
                </span>
              </p>
              {classData.status === 'INACTIVE' ? (
                <p className="text-muted small mb-0">
                  Đã ngưng hoạt động — vẫn có thể kích hoạt lại qua trang
                  Chỉnh sửa.
                </p>
              ) : null}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Mô tả</h2>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {classData.description ? classData.description : '—'}
          </p>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Bộ môn</h2>
          {classData.disciplineId ? (
            <Link
              to={`/manager/disciplines/${classData.disciplineId}`}
              className="fw-semibold text-decoration-none"
            >
              {classData.disciplineName || '—'}
            </Link>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}