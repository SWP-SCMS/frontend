import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { useAuth } from '../../../context/useAuth';
import { getManagerDashboard } from '../../../services/managerReportingService';
import { formatPrice } from '../../../utils';

function Metric({ label, value, note, to }) {
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
                Mở danh sách
              </Button>
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </Col>
  );
}

function AttentionItem({ count, title, description, to, clearText }) {
  const numericCount = Number(count) || 0;
  const needsAttention = numericCount > 0;

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 py-3 border-bottom">
      <div className="d-flex align-items-start gap-3">
        <span
          className={`badge rounded-pill mt-1 ${needsAttention ? 'text-bg-warning' : 'text-bg-success'}`}
        >
          {numericCount}
        </span>
        <div>
          <div className="fw-semibold">{title}</div>
          <div className="text-muted small">
            {needsAttention ? description : clearText}
          </div>
        </div>
      </div>
      <Button as={Link} to={to} variant="outline-secondary" size="sm">
        Kiểm tra
      </Button>
    </div>
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
            />
          </Row>

          <Row className="g-3">
            <Col xl={7}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h2 className="h5 fw-bold mb-1">Việc cần chú ý</h2>
                  <p className="text-muted small mb-1">
                    Những trạng thái nên được kiểm tra trong ca vận hành hiện tại.
                  </p>
                  <AttentionItem
                    count={data.centerVisits?.openVisits}
                    title="Lượt vào chưa checkout"
                    description="Cần kiểm tra các hội viên chưa được ghi nhận rời trung tâm."
                    clearText="Không có lượt vào nào đang mở."
                    to="/manager/reports"
                  />
                  <AttentionItem
                    count={data.members?.suspendedMembers}
                    title="Tài khoản hội viên đang tạm khóa"
                    description="Kiểm tra trạng thái và lý do tạm khóa nếu cần xử lý."
                    clearText="Không có hội viên nào đang tạm khóa."
                    to="/manager/members"
                  />
                  <AttentionItem
                    count={data.bookings?.cancelledBookings}
                    title="Lượt đặt đã hủy"
                    description="Xem báo cáo chi tiết nếu số lượt hủy có dấu hiệu bất thường."
                    clearText="Chưa ghi nhận lượt đặt bị hủy."
                    to="/manager/reports"
                  />
                </Card.Body>
              </Card>
            </Col>

            <Col xl={5}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h2 className="h5 fw-bold mb-1">Đi nhanh</h2>
                  <p className="text-muted small mb-3">
                    Mở các khu vực quản lý thường dùng.
                  </p>
                  <div className="d-grid gap-2">
                    <Button as={Link} to="/manager/class-sessions" variant="outline-danger">
                      Quản lý buổi tập
                    </Button>
                    <Button as={Link} to="/manager/members" variant="outline-danger">
                      Quản lý hội viên
                    </Button>
                    <Button as={Link} to="/manager/reports" variant="danger">
                      Xem báo cáo chi tiết
                    </Button>
                    <Button as={Link} to="/manager/audit-events" variant="outline-secondary">
                      Lịch sử hoạt động
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      ) : null}
    </div>
  );
}
