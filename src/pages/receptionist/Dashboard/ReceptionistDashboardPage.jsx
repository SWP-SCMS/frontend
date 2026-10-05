// Receptionist dashboard.
//
// Lightweight landing page for RECEPTIONIST role. Shows the receptionist's
// cached account info (from JWT claims — no BE round-trip) and quick links to
// the surfaces that actually exist in the backend today.
//
// Every link here maps to a shipped endpoint:
//   /reception/members         -> GET /reception/members/search         (US11)
//   /reception/members/new     -> POST /reception/members               (US15)
//   /reception/orders/new      -> POST /reception/members/{id}/membership-orders (US16)
//   /reception/membership-offers -> GET /membership-offers              (US12)

import { Link } from 'react-router-dom';
import { Card, Col, Row, Button } from 'react-bootstrap';
import { useAuth } from '../../../context/useAuth';
import { ROLE_LABELS } from '../../../constants';

const DASHBOARD_LINKS = [
  {
    title: 'Tra cứu hội viên',
    description:
      'Tìm chính xác một hội viên bằng mã hội viên hoặc số điện thoại, rồi xem và cập nhật hồ sơ.',
    to: '/reception/members',
    cta: 'Tra cứu ngay',
  },
  {
    title: 'Đăng ký hội viên mới',
    description:
      'Tạo tài khoản hội viên tại quầy. Mật khẩu khởi tạo được sinh từ số điện thoại.',
    to: '/reception/members/new',
    cta: 'Đăng ký hội viên',
  },
  {
    // Points at the member LIST, not /orders/new: creating an order needs a
    // member, and /orders/new without ?memberId= is an EmptyState telling the
    // user to go find one. Sending staff through the list first is the
    // shortest honest path.
    title: 'Tạo đơn gói tập',
    description:
      'Tìm hội viên rồi tạo đơn chuyển khoản ngân hàng. Đơn ở trạng thái chờ thanh toán tới khi bạn đối soát.',
    to: '/reception/members',
    cta: 'Tạo đơn',
  },
  {
    // Separate from the order card above because cash is its own endpoint
    // (US20) and starts with a member lookup, not an offer picker.
    title: 'Thu tiền mặt',
    description:
      'Tìm hội viên, chọn gói tập và xác nhận đã nhận tiền mặt. Gói được kích hoạt và xuất biên lai ngay.',
    to: '/reception/payments/cash',
    cta: 'Thu tiền mặt',
  },
  {
    title: 'Gói tập',
    description: 'Xem các gói tập BASIC và PLUS đang được bán tại trung tâm.',
    to: '/reception/membership-offers',
    cta: 'Xem gói tập',
  },
];

export default function ReceptionistDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">
          Xin chào, {user?.fullName || 'Lễ tân'}!
        </h1>
        <p className="text-muted mb-0">
          Đây là trang tổng quan dành cho lễ tân trung tâm.
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
        Thanh toán tại quầy hỗ trợ <strong>tiền mặt</strong> (kích hoạt ngay tại
        màn hình Thu tiền mặt) và <strong>chuyển khoản ngân hàng</strong> (tạo
        đơn rồi đối soát). Các chức năng đặt lịch và điểm danh sẽ được bổ sung
        khi backend có endpoint tương ứng.
      </p>
    </div>
  );
}
