// Header cho khu vực staff (Manager / Receptionist).
// Mirror MemberHeader.jsx về mặt visual nhưng:
//   - Dùng class .scms-sd-* (không đụng .scms-ml-* của Member).
//   - Role chip và avatar-fallback lấy từ prop roleLabel
//     (thay vì hard-code "Hội viên" như Member).
//   - Không hiển thị UUID tài khoản trong giao diện nghiệp vụ.
//   - Vùng top-nav render rỗng (không có top-nav cho staff ở phase này).
//
// Component chỉ render — không tải dữ liệu, không gọi API.

import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StaffIcon from './StaffIcon';

export default function StaffHeader({ user, roleLabel, unreadCount = 0, notificationPath, onRequestLogout }) {
  const hasUnread = unreadCount > 0;
  return (
    <header className="scms-sd-header">
      <nav className="scms-sd-topnav">
        {notificationPath ? (
          <Dropdown align="start">
            <Dropdown.Toggle
              as="button"
              type="button"
              className="scms-sd-bell"
              aria-label={hasUnread ? `Thông báo (${unreadCount} mới)` : 'Thông báo'}
              id="staff-notification-bell"
            >
              <StaffIcon name="bell" size={20} />
              {hasUnread ? <span className="scms-sd-bell-dot" aria-hidden="true"></span> : null}
            </Dropdown.Toggle>
            <Dropdown.Menu className="scms-sd-bell-menu">
              <div className="scms-sd-bell-head">Thông báo</div>
              <div className="scms-sd-bell-empty">
                {hasUnread ? `Bạn có ${unreadCount} thông báo mới.` : 'Chưa có thông báo nào.'}
              </div>
              <Dropdown.Item as={Link} to={notificationPath} className="small text-danger">
                Xem tất cả thông báo
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : null}
      </nav>

      <div className="scms-sd-user">
        <span className="scms-sd-role">
          <span className="scms-sd-role-dot" aria-hidden="true"></span>
          {roleLabel}
        </span>
        <div className="scms-sd-user-text">
          <span className="scms-sd-user-name">
            {user?.fullName || roleLabel}
          </span>
          {user?.email ? (
            <span className="scms-sd-user-code">{user.email}</span>
          ) : null}
        </div>
        <span className="scms-sd-avatar" aria-hidden="true">
          <StaffIcon name="user" size={18} />
        </span>
        <button
          type="button"
          className="scms-sd-logout"
          onClick={onRequestLogout}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
