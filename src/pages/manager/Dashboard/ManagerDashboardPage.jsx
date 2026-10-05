// Manager dashboard.
//
// Lightweight landing page for MANAGER role. Shows the manager's cached
// account info (from JWT claims — no BE round-trip) and quick links to
// the staff-account management surface (US05-08). Real operational
// widgets (membership revenue, member status, etc.) are wired up in
// later phases per the handoff.

import { Link } from 'react-router-dom';
import { Card, Col, Row, Button } from 'react-bootstrap';
import { useAuth } from '../../../context/useAuth';
import { ROLE_LABELS } from '../../../constants';

const DASHBOARD_LINKS = [
  {
    title: 'Tài khoản nhân viên & quản lý',
    description:
      'Tạo, cập nhật, khoá và đặt lại mật khẩu tài khoản COACH / RECEPTIONIST / MANAGER (US05-08).',
    to: '/manager/staff-accounts',
    cta: 'Mở danh sách',
  },
  {
    title: 'Gói tập',
    description:
      'Tạo / cập nhật các gói tập BASIC và PLUS hiển thị cho hội viên.',
    to: '/manager/membership-offers',
    cta: 'Quản lý gói tập',
  },
  {
    title: 'Hội viên',
    description:
      'Xem và cập nhật trạng thái tài khoản hội viên (ACTIVE / INACTIVE / SUSPENDED).',
    to: '/manager/members',
    cta: 'Mở danh sách hội viên',
  },
  {
    title: 'Báo cáo doanh thu',
    description:
      'Xem doanh thu gói tập và tình hình Membership theo khoảng thời gian (US22).',
    to: '/manager/reports',
    cta: 'Xem báo cáo',
  },
];

export default function ManagerDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">
          Xin chào, {user?.fullName || 'Quản lý'}!
        </h1>
        <p className="text-muted mb-0">
          Đây là trang tổng quan dành cho quản lý trung tâm.
        </p>
      </div>

      <Row className="g-3 mb-4">
        <Col md={6} lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Họ tên</div>
              <div className="fw-semibold">{user?.fullName || '—'}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Vai trò</div>
              <div className="fw-semibold">
                {ROLE_LABELS[user?.role] || user?.role || '—'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Mã tài khoản</div>
              <div
                className="fw-semibold text-truncate"
                title={user?.accountId || ''}
              >
                {user?.accountId || '—'}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h2 className="h5 fw-bold mb-3">Truy cập nhanh</h2>
      <Row className="g-3">
        {DASHBOARD_LINKS.map((link) => (
          <Col md={6} key={link.to}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex flex-column">
                <h3 className="h6 fw-bold mb-2">{link.title}</h3>
                <p className="text-muted small mb-3 flex-grow-1">
                  {link.description}
                </p>
                <div>
                  <Button
                    as={Link}
                    to={link.to}
                    variant="outline-danger"
                    size="sm"
                  >
                    {link.cta}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <p className="text-muted small mt-4 mb-0">
        Các widget vận hành chi tiết (tỉ lệ churn, lịch sử hoạt động) sẽ
        được bổ sung ở các phase sau. Hiện tại bạn có thể quản lý nhân viên,
        gói tập, hội viên và xem báo cáo doanh thu từ các liên kết ở trên.
      </p>
    </div>
  );
}
