// Manager – Discipline detail (US23).
//
// Read-only view of a single discipline. Loads via the dedicated
// GET /api/v1/manager/disciplines/{disciplineId} endpoint.
//
// DisciplineResponse exposes exactly four fields today:
//   { id, name, description, status }
// createdAt / updatedAt / version are NOT in the response DTO and are NOT
// rendered here (per plan §L).

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getDiscipline } from '../../../services/disciplineService';

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

export default function DisciplineDetailPage() {
  const { disciplineId } = useParams();
  const [discipline, setDiscipline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDiscipline(disciplineId);
      setDiscipline(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [disciplineId]);

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

  if (error || !discipline) {
    return (
      <div>
        <Link
          to="/manager/disciplines"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được bộ môn"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/manager/disciplines"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{discipline.name || '—'}</h1>
          <p className="text-muted mb-0">Bộ môn đào tạo</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/disciplines/${discipline.id}/edit`}
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
              <h2 className="h6 text-uppercase text-muted">Trạng thái</h2>
              <p className="mb-0">
                <span
                  className={`badge ${
                    STATUS_BADGE[discipline.status] || 'bg-light text-dark'
                  }`}
                >
                  {discipline.status || '—'}
                </span>
              </p>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Tên</h2>
              <p className="mb-0 fw-semibold">{discipline.name || '—'}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Mô tả</h2>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {discipline.description ? discipline.description : '—'}
          </p>
        </Card.Body>
      </Card>
    </div>
  );
}