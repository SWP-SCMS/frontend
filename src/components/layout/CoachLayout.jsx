// Khung giao diện cho khu vực Huấn luyện viên (Coach).
// Giao diện giống MemberLayout (dùng lại CSS .scms-ml-*) nhưng:
//   - Không có chuông thông báo.
//   - Logo KHÔNG bấm được (không bay ra trang chủ).
//   - Không tải gói tập, không có thẻ thành viên.
// Menu: Trang tổng quan, Lịch phụ trách, Hồ sơ cá nhân, Đăng xuất.

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/useAuth';
import Icon from './MemberIcon';
import './MemberLayout.css';
import '../common/BrandLogo.css';

const COACH_SIDEBAR_ITEMS = [
  { to: '/coach/dashboard', label: 'Trang tổng quan', icon: 'dashboard' },
  { to: '/coach/schedule', label: 'Lịch phụ trách', icon: 'calendar' },
  { to: '/coach/profile', label: 'Hồ sơ cá nhân', icon: 'profile' },
];

// Logo giống BrandLogo nhưng là <div>, không có link.
function StaticLogo() {
  return (
    <div className="scms-brandlogo">
      <span className="scms-brandlogo-icon" aria-hidden="true">
        <Icon name="dumbbell" size={22} />
      </span>
      <span>
        <span className="scms-brandlogo-name">SCMS</span>
        <span className="scms-brandlogo-sub">Sports Center</span>
      </span>
    </div>
  );
}

export default function CoachLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Chỉ đăng xuất sau khi bấm "Đăng xuất" trong hộp thoại xác nhận.
  async function handleConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="scms-ml">
      <aside className="scms-ml-sidebar">
        <div>
          <div className="scms-ml-sidebar-logo">
            <StaticLogo />
          </div>
          <div className="scms-ml-sidebar-label">Khu vực Huấn luyện viên</div>
          <nav className="scms-ml-nav">
            {COACH_SIDEBAR_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `scms-ml-navitem${isActive ? ' active' : ''}`
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              className="scms-ml-navitem scms-ml-navbtn"
              onClick={() => setConfirmOpen(true)}
            >
              <Icon name="logout" />
              Đăng xuất
            </button>
          </nav>
        </div>
      </aside>

      <div className="scms-ml-body">
        <header className="scms-ml-header" style={{ justifyContent: 'flex-end' }}>
          <div className="scms-ml-user">
            <span className="scms-ml-role">
              <span className="scms-ml-role-dot" aria-hidden="true"></span>
              Huấn luyện viên
            </span>
            <div className="scms-ml-user-text">
              <span className="scms-ml-user-name">
                {user?.fullName || 'Huấn luyện viên'}
              </span>
            </div>
            <span className="scms-ml-avatar" aria-hidden="true">
              <Icon name="user" size={18} />
            </span>
            <button
              type="button"
              className="scms-ml-logout"
              onClick={() => setConfirmOpen(true)}
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="scms-ml-main">
          <Outlet />
        </main>
      </div>

      <Modal
        show={confirmOpen}
        onHide={() => (loggingOut ? null : setConfirmOpen(false))}
        centered
      >
        <Modal.Header closeButton={!loggingOut}>
          <Modal.Title className="h5">Xác nhận đăng xuất</Modal.Title>
        </Modal.Header>
        <Modal.Body>Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?</Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setConfirmOpen(false)}
            disabled={loggingOut}
          >
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
