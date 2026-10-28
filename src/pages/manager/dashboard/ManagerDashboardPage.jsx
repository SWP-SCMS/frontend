import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import { useAuth } from '../../../context/useAuth';
import { getManagerDashboard } from '../../../services/managerReportingService';
import { formatPrice } from '../../../utils';

function Metric({ label, value, note, to, actionLabel = 'Mở danh sách' }) {
  return (
    <Col md={6} xl={3}>
      <Card className="border-0 shadow-sm h-100">
        <Card.Body className="d-flex flex-column">
          <div className="text-muted small">{label}</div>
          <div className="h4 fw-bold mb-1">{value ?? '—'}</div>
          {note ? <div className="text-muted small mb-3">{note}</div> : null}
          {to ? (
            <div className="mt-auto">
              <Button as={Link} to={to} size="sm" variant="outline-danger">
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </Col>
  );
}

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getManagerDashboard()); } catch (err) { setError(err); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const refreshInBackground = useCallback(async () => {
    try { setData(await getManagerDashboard()); } catch { /* Keep the last dashboard snapshot on transient failures. */ }
  }, []);
  useAutoRefresh(refreshInBackground);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">
            Xin chào, {user?.fullName || 'Quản lý'}!
          </h1>
          <p className="text-muted mb-0">
            Theo dõi nhanh tình trạng hiện tại và đi tới công việc cần xử lý.
          </p>
        </div>
        <Button variant="outline-danger" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại'}
        </Button>
      </div>

      <ErrorAlert
        error={error}
        title="Không tải được tổng quan quản lý"
        onClose={() => setError(null)}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : data ? (
        <>
          <h2 className="h5 fw-bold mb-3">Tình hình hiện tại</h2>
          <Row className="g-3 mb-4">
            <Metric
              label="Hội viên đang hoạt động"
              value={data.members?.activeMembers}
              note={`${data.members?.totalMembers || 0} hội viên trong hệ thống`}
              to="/manager/members"
            />
            <Metric
              label="Doanh thu đã thanh toán"
              value={formatPrice(data.membershipRevenue?.paidRevenue, 'VND')}
              note={`${data.membershipRevenue?.paidPayments || 0} giao dịch thành công`}
              to="/manager/reports/revenue"
              actionLabel="Xem báo cáo"
            />
            <Metric
              label="Lượt đặt còn hiệu lực"
              value={data.bookings?.bookedBookings}
              note="Các lịch đặt chưa bị hủy"
              to="/manager/class-sessions"
            />
            <Metric
              label="Lượt chưa checkout"
              value={data.centerVisits?.openVisits}
              note="Hội viên hiện vẫn được ghi nhận trong trung tâm"
              to="/manager/reports"
              actionLabel="Xem báo cáo"
            />
          </Row>

          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h2 className="h5 fw-bold mb-1">Đi nhanh</h2>
              <p className="text-muted small mb-3">
                Mở các khu vực quản lý thường dùng.
              </p>
              <Row className="g-2">
                <Col sm={6} xl={3}>
                  <Button as={Link} to="/manager/class-sessions" variant="outline-danger" className="w-100">
                    Quản lý buổi tập
                  </Button>
                </Col>
                <Col sm={6} xl={3}>
                  <Button as={Link} to="/manager/members" variant="outline-danger" className="w-100">
                    Quản lý hội viên
                  </Button>
                </Col>
                <Col sm={6} xl={3}>
                  <Button as={Link} to="/manager/reports" variant="danger" className="w-100">
                    Xem báo cáo chi tiết
                  </Button>
                </Col>
                <Col sm={6} xl={3}>
                  <Button as={Link} to="/manager/audit-events" variant="outline-secondary" className="w-100">
                    Lịch sử hoạt động
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </>
      ) : null}
    </div>
  );
}
