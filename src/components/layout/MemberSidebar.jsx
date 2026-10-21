// Sidebar của Member area. Tách ra từ MemberLayout.jsx (Phase 3) để
// MemberLayout tập trung vào việc tải dữ liệu và quản lý logout modal.
//
// Component này:
//   - Nhận `items` qua props (KHÔNG import navConfig.js, KHÔNG dùng MemberAreaContext).
//   - Chỉ render — không tải dữ liệu, không gọi API.

import { NavLink } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import Icon from './MemberIcon';

function SidebarItem({
  item,
  isBenefitLocked,
  getRequiredPlanLabel,
  onLockedClick,
}) {
  if (isBenefitLocked(item.requiredBenefit)) {
    const requiredPlanLabel = getRequiredPlanLabel(item.requiredBenefit);
    return (
      <button
        type="button"
        className="scms-ml-navitem locked"
        onClick={() => onLockedClick(item)}
        title={
          requiredPlanLabel
            ? `Tính năng có trong gói ${requiredPlanLabel}`
            : 'Gói tập hiện tại chưa bao gồm tính năng này'
        }
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="scms-ml-benefit">
          {requiredPlanLabel || 'Theo gói'}
        </span>
      </button>
    );
  }
  if (!item.to) {
    return (
      <span
        className="scms-ml-navitem disabled"
        aria-disabled="true"
        title="Sắp ra mắt"
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="scms-ml-soon">Sắp ra mắt</span>
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        `scms-ml-navitem${isActive ? ' active' : ''}`
      }
    >
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}

export default function MemberSidebar({
  user,
  activeMembership,
  statusText,
  items,
  isBenefitLocked = () => false,
  getRequiredPlanLabel = () => null,
  onLockedClick = () => {},
  onRequestLogout,
}) {
  return (
    <aside className="scms-ml-sidebar">
      <div>
        <div className="scms-ml-sidebar-logo">
          <BrandLogo />
        </div>
        <div className="scms-ml-sidebar-label">Khu vực Hội viên</div>
        <nav className="scms-ml-nav">
          {items.map((section) => (
            <div className="scms-ml-navgroup" key={section.label}>
              <div className="scms-ml-navgroup-label">{section.label}</div>
              <div className="scms-ml-navgroup-items">
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.label}
                    item={item}
                    isBenefitLocked={isBenefitLocked}
                    getRequiredPlanLabel={getRequiredPlanLabel}
                    onLockedClick={onLockedClick}
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="scms-ml-navitem scms-ml-navbtn"
            onClick={onRequestLogout}
          >
            <Icon name="logout" />
            Đăng xuất
          </button>
        </nav>
      </div>

      <div className="scms-ml-card">
        <div className="scms-ml-card-head">
          <span>Thẻ thành viên</span>
          <span
            className={`scms-ml-dot${activeMembership ? ' on' : ''}`}
            aria-hidden="true"
          ></span>
        </div>
        <div className="scms-ml-card-code">{user?.memberId || '—'}</div>
        <div
          className={`scms-ml-card-status${activeMembership ? ' on' : ''}`}
        >
          {statusText}
        </div>
      </div>
    </aside>
  );
}
