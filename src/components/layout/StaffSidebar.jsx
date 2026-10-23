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

import { useEffect, useMemo, useState } from 'react';
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
  if (to.endsWith('/profile')) return 'user';
  if (to.includes('/notifications')) return 'bell';
  if (to === '/reception/center-visits') return 'members';
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
  // Session list/calendar (Manager only — US28)
  if (to.startsWith('/manager/class-sessions')) return 'calendar';
  // Order creation (Receptionist only)
  if (to === '/reception/orders/new') return 'order-new';
  // Membership offers (both Manager and Receptionist)
  if (to.includes('/membership-offers')) return 'offer';
  // Reports (Manager only)
  if (to.startsWith('/manager/reports') || to === '/manager/audit-events') return 'reports';
  // Payment reconciliation (both Manager and Receptionist)
  if (to.includes('/payments/reconcile')) return 'reconcile';
  if (to.includes('/refunds')) return 'reconcile';
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
  const flatItems = useMemo(
    () => items.flatMap((section) => section.items ?? []),
    [items],
  );
  const activeIndex = findActiveIndex(pathname, flatItems);
  const activeItem = flatItems[activeIndex];
  const activeSectionIndex = items.findIndex((section) =>
    section.items?.some((item) => item.to === activeItem?.to),
  );
  const [openSections, setOpenSections] = useState(() =>
    new Set(activeSectionIndex >= 0 ? [activeSectionIndex] : [0]),
  );

  useEffect(() => {
    if (activeSectionIndex < 0) return;
    setOpenSections((current) => {
      if (current.has(activeSectionIndex)) return current;
      const next = new Set(current);
      next.add(activeSectionIndex);
      return next;
    });
  }, [activeSectionIndex]);

  function toggleSection(index) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <aside className="scms-sd-sidebar">
      <div>
        <div className="scms-sd-sidebar-logo">
          <BrandLogo />
        </div>
        <div className="scms-sd-sidebar-label">{sidebarLabel}</div>
        <nav className="scms-sd-nav">
          {items.map((section, sectionIndex) => {
            const isOpen = openSections.has(sectionIndex);
            return (
              <div className="scms-sd-navgroup" key={section.label}>
                <button
                  type="button"
                  className="scms-sd-navgroup-toggle"
                  onClick={() => toggleSection(sectionIndex)}
                  aria-expanded={isOpen}
                  aria-controls={`staff-nav-section-${sectionIndex}`}
                >
                  <span>{section.label}</span>
                  <span
                    className={`scms-sd-navgroup-chevron${isOpen ? ' open' : ''}`}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
                <div
                  id={`staff-nav-section-${sectionIndex}`}
                  className="scms-sd-navgroup-items"
                  hidden={!isOpen}
                >
                  {section.items.map((item) => {
                    const itemIndex = flatItems.findIndex((candidate) => candidate.to === item.to);
                    const isActive = itemIndex === activeIndex;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`scms-sd-navitem${isActive ? ' active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <StaffIcon name={iconForRoute(item.to)} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
