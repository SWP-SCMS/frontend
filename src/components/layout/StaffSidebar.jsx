// Sidebar cho khu vực staff (Manager / Receptionist).
// Mirror MemberSidebar.jsx về mặt visual nhưng:
//   - Dùng class .scms-sd-* (không đụng .scms-ml-* của Member).
//   - Icon chọn theo URL qua helper iconForRoute (không phụ thuộc item.icon).
//   - Không render thẻ thành viên (chỉ Member mới có).
//
// Active-state strategy: a deterministic custom matcher (findActiveIndex)
// is the single source of truth for both the visual `active` class and the
// `aria-current` attribute on each link. We render with <Link> (not
// <NavLink>) so React Router's built-in active-state logic does not
// compete with the matcher.
//
// Component chỉ render — không tải dữ liệu, không gọi API.

import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import StaffIcon from './StaffIcon';

// Helper: ánh xạ URL -> tên icon trong StaffIcon.jsx.
// Định nghĩa local ở đây để staff shell không phụ thuộc vào việc
// APP_SHELL_NAV_ITEMS có trường `icon` (nó không có — đó là thiết kế cố ý).
function iconForRoute(to) {
  if (!to) return 'dashboard';
  // Dashboard entries
  if (to === '/manager/dashboard' || to === '/reception/dashboard') return 'dashboard';
  // Staff / accounts management (Manager only)
  if (to.startsWith('/manager/staff-accounts')) return 'staff';
  // Member management
  if (to === '/reception/members') return 'members';
  if (to === '/manager/members' || to.startsWith('/manager/members/')) return 'members';
  if (to === '/reception/members/new') return 'member-new';
  // Discipline management (Manager only — US23)
  if (to.startsWith('/manager/disciplines')) return 'discipline';
  // Class management (Manager only — US24)
  if (to.startsWith('/manager/classes')) return 'class';
  // Room management (Manager only — US25)
  if (to.startsWith('/manager/rooms')) return 'room';
  // Order creation (Receptionist only)
  if (to === '/reception/orders/new') return 'order-new';
  // Membership offers (both Manager and Receptionist)
  if (to.includes('/membership-offers')) return 'offer';
  // Reports (Manager only)
  if (to === '/manager/reports') return 'reports';
  // Payment reconciliation (both Manager and Receptionist)
  if (to.includes('/payments/reconcile')) return 'reconcile';
  // Cash payment (Receptionist only)
  if (to === '/reception/payments/cash') return 'cash';
  return 'dashboard';
}

// Custom active-state matcher.
//
// Rule A (exact-match precedence):
//   If the current pathname exactly equals an item's `to`, that item is
//   active and no other item is active.
//
// Rule B (longest-prefix fallback):
//   Otherwise, find every item whose `to` is a strict parent prefix of the
//   pathname (i.e. pathname.startsWith(item.to + '/')) and return the one
//   with the longest `to`.
//
// If neither rule matches, return -1 (no item is active).
//
// Deterministic, pure, O(n) over the sidebar item count (6 Manager, 7
// Receptionist). The `+ '/'` separator on the prefix check is critical —
// without it, /reception/members would also be considered a prefix of any
// hypothetical /reception/members-archive future route.
function findActiveIndex(pathname, items) {
  // Rule A.
  const exact = items.findIndex((it) => it.to === pathname);
  if (exact !== -1) return exact;
  // Rule B.
  let best = -1;
  let bestLen = -1;
  items.forEach((it, i) => {
    if (pathname.startsWith(it.to + '/') && it.to.length > bestLen) {
      best = i;
      bestLen = it.to.length;
    }
  });
  return best;
}

export default function StaffSidebar({
  sidebarLabel,
  items,
  onRequestLogout,
}) {
  const { pathname } = useLocation();
  const activeIndex = findActiveIndex(pathname, items);
  return (
    <aside className="scms-sd-sidebar">
      <div>
        <div className="scms-sd-sidebar-logo">
          <BrandLogo />
        </div>
        <div className="scms-sd-sidebar-label">{sidebarLabel}</div>
        <nav className="scms-sd-nav">
          {items.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className={`scms-sd-navitem${i === activeIndex ? ' active' : ''}`}
              aria-current={i === activeIndex ? 'page' : undefined}
            >
              <StaffIcon name={iconForRoute(item.to)} />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="scms-sd-navitem scms-sd-navbtn"
            onClick={onRequestLogout}
          >
            <StaffIcon name="logout" />
            Đăng xuất
          </button>
        </nav>
      </div>
    </aside>
  );
}