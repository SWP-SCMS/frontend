// Header của Member area. Tách ra từ MemberLayout.jsx (Phase 3) để
// MemberLayout tập trung vào việc tải dữ liệu và quản lý logout modal.
//
// Component này:
//   - KHÔNG import navConfig.js, KHÔNG dùng MemberAreaContext.
//   - Chỉ render — không tải dữ liệu, không gọi API.
//
// Bên trái là nút chuông thông báo. `unreadCount` là số thông báo chưa đọc:
// lớn hơn 0 thì hiện chấm đỏ ở góc chuông. MemberLayout lấy số chưa đọc từ
// API dùng chung; menu dẫn đến trang thông báo đầy đủ để đọc và cập nhật.

import { Dropdown } from 'react-bootstrap';
import Icon from './MemberIcon';
import NotificationBellContent from './NotificationBellContent';

export default function MemberHeader({
  user,
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
    <header className="scms-ml-header">
      <Dropdown align="start">
        <Dropdown.Toggle
          as="button"
          type="button"
          className="scms-ml-bell"
          aria-label={hasUnread ? `Thông báo (${unreadCount} mới)` : 'Thông báo'}
          id="member-bell"
        >
          <Icon name="bell" size={20} />
          {hasUnread ? (
            <span className="scms-ml-bell-dot" aria-hidden="true"></span>
          ) : null}
        </Dropdown.Toggle>
        <Dropdown.Menu className="scms-ml-bell-menu">
          <NotificationBellContent
            notifications={notifications}
            unreadCount={unreadCount}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMoreError={loadMoreError}
            onLoadMore={onLoadMore}
            classPrefix="scms-ml"
          />
        </Dropdown.Menu>
      </Dropdown>

      <div className="scms-ml-user">
        <span className="scms-ml-role">
          <span className="scms-ml-role-dot" aria-hidden="true"></span>
          Hội viên
        </span>
        <div className="scms-ml-user-text">
          <span className="scms-ml-user-name">
            {user?.fullName || 'Hội viên'}
          </span>
          <span className="scms-ml-user-code">
            {user?.memberId || '—'}
          </span>
        </div>
        <span className="scms-ml-avatar" aria-hidden="true">
          <Icon name="user" size={18} />
        </span>
        <button
          type="button"
          className="scms-ml-logout"
          onClick={onRequestLogout}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
