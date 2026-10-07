// Header cho khu vực staff (Manager / Receptionist).
// Mirror MemberHeader.jsx về mặt visual nhưng:
//   - Dùng class .scms-sd-* (không đụng .scms-ml-* của Member).
//   - Role chip và avatar-fallback lấy từ prop roleLabel
//     (thay vì hard-code "Hội viên" như Member).
//   - accountId lấy từ user?.accountId (staff user có accountId, không có memberId).
//   - Vùng top-nav render rỗng (không có top-nav cho staff ở phase này).
//
// Component chỉ render — không tải dữ liệu, không gọi API.

import StaffIcon from './StaffIcon';

export default function StaffHeader({ user, roleLabel, onRequestLogout }) {
  return (
    <header className="scms-sd-header">
      <nav className="scms-sd-topnav">{/* intentionally empty for staff area */}</nav>

      <div className="scms-sd-user">
        <span className="scms-sd-role">
          <span className="scms-sd-role-dot" aria-hidden="true"></span>
          {roleLabel}
        </span>
        <div className="scms-sd-user-text">
          <span className="scms-sd-user-name">
            {user?.fullName || roleLabel}
          </span>
          <span className="scms-sd-user-code">
            {user?.accountId || '—'}
          </span>
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