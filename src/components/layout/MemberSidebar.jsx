import SystemBadge from '../common/SystemBadge';
// Sidebar của Member area. Tách ra từ MemberLayout.jsx (Phase 3) để
// MemberLayout tập trung vào việc tải dữ liệu và quản lý logout modal.
//
// Component này:
//   - Nhận `items` qua props (KHÔNG import navConfig.js, KHÔNG dùng MemberAreaContext).
//   - Chỉ render — không tải dữ liệu, không gọi API.

import { NavLink, useLocation } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import Icon from './MemberIcon';

function SidebarItem({
  item,
  isBenefitLocked,
  getRequiredPlanLabel,
  onLockedClick,
}) {
  const { pathname } = useLocation();
  const matchesAlias = item.activePaths?.includes(pathname);
  if (isBenefitLocked(item.requiredBenefit)) {
    const requiredPlanLabel = getRequiredPlanLabel(item.requiredBenefit);
    return (
      <button
        type="button"
        className="scms-app-navitem locked"
        onClick={() => onLockedClick(item)}
        title={
          requiredPlanLabel
            ? `Tính năng có trong gói ${requiredPlanLabel}`
            : 'Gói tập hiện tại chưa bao gồm tính năng này'
        }
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="scms-app-benefit">
          {requiredPlanLabel || 'Theo gói'}
        </span>
      </button>
    );
  }
  if (!item.to) {
    return (
      <span
        className="scms-app-navitem disabled"
        aria-disabled="true"
        title="Sắp ra mắt"
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="scms-app-soon">Sắp ra mắt</span>
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      aria-current={matchesAlias ? 'page' : undefined}
      className={({ isActive }) =>
        `scms-app-navitem${isActive || matchesAlias ? ' active' : ''}`
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
  const { pathname } = useLocation();
  return (
    <aside className="scms-app-sidebar">
      <div>
        <div className="scms-app-sidebar-logo">
          <BrandLogo />
        </div>
        <div className="scms-app-sidebar-label">Khu vực Hội viên</div>
        <nav className="scms-app-nav">
          {items.map((section) => {
            const collapsible = section.collapsible !== false;
            const Group = collapsible ? 'details' : 'div';
            const isCurrentSection = section.items.some(item => item.to && (
              pathname === item.to || item.activePaths?.includes(pathname) || (!item.end && pathname.startsWith(`${item.to}/`))
            )) || (section.label === 'Khóa học' && pathname.startsWith('/member/courses/enrollments/'));
            return (
            <div className="scms-app-navgroup" key={section.label}>
              <Group key={pathname} {...(collapsible ? { open: isCurrentSection || undefined } : {})}>
              {collapsible ? <summary className="scms-app-navgroup-label" style={{ cursor: 'pointer' }}>{section.label}</summary> : <div className="scms-app-navgroup-label">{section.label}</div>}
              <div className="scms-app-navgroup-items">
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
              </Group>
            </div>
          ); })}
          <button
            type="button"
            className="scms-app-navitem scms-app-navbtn"
            onClick={onRequestLogout}
          >
            <Icon name="logout" />
            Đăng xuất
          </button>
        </nav>
      </div>

      <div className="scms-app-card">
        <div className="scms-app-card-head">
          <span>Thẻ thành viên</span>
          <span
            className={`scms-app-dot${activeMembership ? ' on' : ''}`}
            aria-hidden="true"
          ></span>
        </div>
        <div className="scms-app-card-code">{user?.memberId || '—'}</div>
        <SystemBadge className="scms-app-card-status mt-2" tone={activeMembership ? 'green' : 'neutral'}>
          {statusText}
        </SystemBadge>
      </div>
    </aside>
  );
}
