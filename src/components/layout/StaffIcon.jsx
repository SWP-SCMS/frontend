// Icon SVG cho khu vực staff (Manager / Receptionist).
// Tách riêng MemberIcon.jsx để staff shell không phụ thuộc Member area.
// Cố ý giữ scoped: chỉ StaffSidebar / StaffHeader dùng.
//
// Bộ icon ở đây phục vụ staff sidebar (9 icon theo bảng iconForRoute trong
// StaffSidebar.jsx) và header (user, logout). Không thêm icon trừu
// tượng dùng chung.

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  staff: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 20v-1.5a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3V20" />
    </>
  ),
  members: (
    <>
      <circle cx="11" cy="8" r="4" />
      <path d="M3 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  'member-new': (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V20" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  offer: (
    <>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.2" />
    </>
  ),
  reports: (
    <>
      <path d="M3 21V3" />
      <path d="M21 21H3" />
      <path d="M7 17v-4" />
      <path d="M11 17V9" />
      <path d="M15 17v-7" />
      <path d="M19 17v-2" />
    </>
  ),
  reconcile: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  'order-new': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 14v4M10 16h4" />
    </>
  ),
  discipline: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h8M8 17h8" />
    </>
  ),
  class: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 4v16M15 4v16" />
    </>
  ),
  room: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M3 9h18" />
      <circle cx="6" cy="6" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

export default function StaffIcon({ name, size = 18 }) {
  const body = ICONS[name] ?? ICONS.dashboard;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
      {body}
    </svg>
  );
}