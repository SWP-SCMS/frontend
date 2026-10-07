// Cấu hình điều hướng dùng chung cho khu vực Hội viên và staff shell.
// Tách ra từ AppShell.jsx và MemberLayout.jsx (Phase 3).
//
// Lưu ý: giữ nguyên toàn bộ label / url / thứ tự / cờ `end` từ file gốc.

import { ROLES } from '../../constants';

export const APP_SHELL_NAV_ITEMS = {
  [ROLES.RECEPTIONIST]: [
    { to: '/reception/dashboard', label: 'Tổng quan' },
    { to: '/reception/members', label: 'Tra cứu hội viên' },
    { to: '/reception/members/new', label: 'Đăng ký hội viên' },
    { to: '/reception/orders/new', label: 'Tạo đơn gói tập' },
    { to: '/reception/membership-offers', label: 'Gói tập' },
    { to: '/reception/payments/reconcile', label: 'Đối soát' },
    { to: '/reception/payments/cash', label: 'Thu tiền mặt' },
  ],
  [ROLES.COACH]: [{ to: '/coach', label: 'HLV' }],
  [ROLES.MANAGER]: [
    { to: '/manager/dashboard', label: 'Tổng quan' },
    { to: '/manager/staff-accounts', label: 'Nhân viên & QL' },
    { to: '/manager/membership-offers', label: 'Gói tập' },
    { to: '/manager/members', label: 'Hội viên' },
    { to: '/manager/reports', label: 'Báo cáo' },
    { to: '/manager/payments/reconcile', label: 'Đối soát' },
  ],
};

// Mục user dropdown theo role. Member dropdown vẫn nằm inline trong AppShell
// (vì nó chứa "Đổi mật khẩu" — logic vai trò, không phải cấu hình).
export const APP_SHELL_USER_MENU = {
  [ROLES.MANAGER]: [
    { to: '/manager/dashboard', label: 'Trang tổng quan' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/reception/dashboard', label: 'Trang tổng quan' },
  ],
  [ROLES.COACH]: [
    { to: '/coach', label: 'Trang tổng quan' },
  ],
};

// Mục menu bên trái trong Member area. `to: null` nghĩa là chưa có trang -> làm mờ.
export const MEMBER_SIDEBAR_ITEMS = [
  { to: '/member/dashboard', label: 'Trang tổng quan', icon: 'dashboard' },
  { to: '/member/plan', label: 'Gói tập của tôi', icon: 'dumbbell' },
  { to: '/member/memberships', label: 'Lịch sử thanh toán', icon: 'receipt' },
  { to: '/member/profile', label: 'Hồ sơ cá nhân', icon: 'profile', end: true },
  { to: null, label: 'Lịch tập & Check-in', icon: 'calendar' },
];

// Mục menu trên header Member.
export const MEMBER_TOP_ITEMS = [
  { to: '/member/dashboard', label: 'Trang chủ' },
  { to: '/offers', label: 'Gói tập' },
  { to: '/member/profile', label: 'Hồ sơ cá nhân', end: true },
  { to: null, label: 'Lịch tập' },
  { to: null, label: 'Thông báo' },
];

// Nhãn khu vực + role chip cho khu vực staff. Bổ sung cho phase
// staff-area layout unification. Additive only — không đụng 4 export ở trên.
// APP_SHELL_NAV_ITEMS vẫn giữ nguyên (không thêm trường icon, không sửa
// label/url/thứ tự/cờ end) vì StaffSidebar chọn icon theo URL
// qua helper iconForRoute nội bộ.
export const STAFF_LABELS = {
  [ROLES.MANAGER]: {
    sidebarLabel: 'Khu vực Quản lý',
    roleLabel: 'Quản lý',
  },
  [ROLES.RECEPTIONIST]: {
    sidebarLabel: 'Khu vực Lễ tân',
    roleLabel: 'Lễ tân',
  },
};
