// StaffLayout — chrome cho khu vực staff (Manager / Receptionist).
// Mirror Member area về mặt visual (dark sidebar + dark header + light main)
// nhưng KHÔNG dùng MemberLayout:
//   - Không tải gói tập, không có MemberAreaContext.Provider.
//   - Không render thẻ thành viên ở sidebar.
//   - Sidebar items đến từ prop (route file truyền APP_SHELL_NAV_ITEMS[role]).
//   - Role chip / sidebar label đến từ prop.
//
// Component này sở dụng:
//   - useAuth, useNavigate, useState (modal), Modal xác nhận logout,
//   - chuyển về /login sau khi logout xong.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/useAuth';
import StaffSidebar from './StaffSidebar';
import StaffHeader from './StaffHeader';
import './StaffLayout.css';

export default function StaffLayout({
  children,
  sidebarLabel,
  sidebarItems,
  roleLabel,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  function requestLogout() {
    setConfirmOpen(true);
  }

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
    <div className="scms-sd">
      <StaffSidebar
        sidebarLabel={sidebarLabel}
        items={sidebarItems}
        onRequestLogout={requestLogout}
      />

      <div className="scms-sd-body">
        <StaffHeader
          user={user}
          roleLabel={roleLabel}
          onRequestLogout={requestLogout}
        />

        <main className="scms-sd-main">{children}</main>
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