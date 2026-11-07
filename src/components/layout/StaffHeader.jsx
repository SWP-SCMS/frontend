// Header cho khu vực staff (Manager / Receptionist).
// Mirror MemberHeader.jsx về mặt visual nhưng:
//   - Dùng class .scms-app-* (không đụng .scms-app-* của Member).
//   - Role chip và avatar-fallback lấy từ prop roleLabel
//     (thay vì hard-code "Hội viên" như Member).
//   - Không hiển thị UUID tài khoản trong giao diện nghiệp vụ.
//   - Vùng top-nav render rỗng (không có top-nav cho staff ở phase này).
//
// Component chỉ render — không tải dữ liệu, không gọi API.

import { Dropdown } from 'react-bootstrap';
import StaffIcon from './StaffIcon';
import NotificationBellContent from './NotificationBellContent';
import NotificationDropdown from './NotificationDropdown';

export default function StaffHeader({
  user,
  roleLabel,
  unreadCount = 0,
  notifications = [],
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onRequestLogout,
}) {
  const hasUnread = unreadCount > 0;
  return (
    <header className="scms-app-header">
      <nav className="scms-app-topnav">
        <NotificationDropdown align="start">
          <Dropdown.Toggle
            as="button"
            type="button"
            className="scms-app-bell"
            aria-label={hasUnread ? `Thông báo (${unreadCount} mới)` : 'Thông báo'}
            id="staff-notification-bell"
          >
            <StaffIcon name="bell" size={20} />
            {hasUnread ? <span className="scms-app-bell-dot" aria-hidden="true"></span> : null}
          </Dropdown.Toggle>
          <Dropdown.Menu className="scms-app-bell-menu">
            <NotificationBellContent
              notifications={notifications}
              unreadCount={unreadCount}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMoreError={loadMoreError}
              onLoadMore={onLoadMore}
              classPrefix="scms-app"
            />
          </Dropdown.Menu>
        </NotificationDropdown>
      </nav>

      <div className="scms-app-user">
        <span className="scms-app-role">
          <span className="scms-app-role-dot" aria-hidden="true"></span>
          {roleLabel}
        </span>
        <div className="scms-app-user-text">
          <span className="scms-app-user-name">
            {user?.fullName || roleLabel}
          </span>
          {user?.email ? (
            <span className="scms-app-user-code">{user.email}</span>
          ) : null}
        </div>
        <span className="scms-app-avatar" aria-hidden="true">
          <StaffIcon name="user" size={18} />
        </span>
        <button
          type="button"
          className="scms-app-logout"
          onClick={onRequestLogout}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
