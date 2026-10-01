// Member dashboard. Phase 3 shell — only shows the user's cached profile
// for now. Membership/booking/payment sections will be added once the
// corresponding backend endpoints are wired.

import { Link } from 'react-router-dom';
import { Card, Col, Row, Button } from 'react-bootstrap';
import { useAuth } from '../../../context/useAuth';
import { formatDate } from '../../../utils';
import { ROLE_LABELS } from '../../../constants';

export default function MemberDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">
          Xin chào, {user?.fullName || 'hội viên'}!
        </h1>
        <p className="text-muted mb-0">
          Đây là trang tổng quan dành cho hội viên.
        </p>
      </div>

      <Row className="g-3 mb-4">
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Mã hội viên</div>
              <div className="fw-semibold">{user?.memberId || '—'}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Vai trò</div>
              <div className="fw-semibold">
                {ROLE_LABELS[user?.role] || user?.role || '—'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Trạng thái</div>
              <div className="fw-semibold">{user?.status || '—'}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">Ngày sinh</div>
              <div className="fw-semibold">{formatDate(user?.birthDate)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h5 fw-bold mb-2">Hồ sơ cá nhân</h2>
              <p className="text-muted small mb-3">
                Cập nhật thông tin liên hệ, mục tiêu tập luyện và ảnh đại diện.
              </p>
              <Button as={Link} to="/member/profile" variant="outline-danger">
                Mở hồ sơ
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h5 fw-bold mb-2">Gói tập & thanh toán</h2>
              <p className="text-muted small mb-3">
                Mua gói tập mới, tiếp tục thanh toán đang dở, xem biên lai.
              </p>
              <Button as={Link} to="/offers" variant="outline-danger">
                Xem gói tập
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <p className="text-muted small mt-4 mb-0">
        Các mục như đặt lịch lớp, lịch sử tập và thông báo sẽ được bổ sung ở
        giai đoạn tiếp theo (Phase 3).
      </p>
    </div>
  );
}
