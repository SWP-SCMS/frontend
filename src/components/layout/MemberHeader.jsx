// Header của Member area. Tách ra từ MemberLayout.jsx (Phase 3) để
// MemberLayout tập trung vào việc tải dữ liệu và quản lý logout modal.
//
// Component này:
//   - Nhận `items` qua props (KHÔNG import navConfig.js, KHÔNG dùng MemberAreaContext).
//   - Chỉ render — không tải dữ liệu, không gọi API.

import { NavLink } from 'react-router-dom';
import Icon from './MemberIcon';

function TopItem({ item }) {
  if (!item.to) {
    return (
      <span
        className="scms-ml-toplink disabled"
        aria-disabled="true"
        title="Sắp ra mắt"
      >
        {item.label}
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        `scms-ml-toplink${isActive ? ' active' : ''}`
      }
    >
      {item.label}
    </NavLink>
  );
}

export default function MemberHeader({ user, items, onRequestLogout }) {
  return (
    <header className="scms-ml-header">
      <nav className="scms-ml-topnav">
        {items.map((item) => (
          <TopItem key={item.label} item={item} />
        ))}
      </nav>

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
