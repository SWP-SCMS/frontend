// Cấu hình điều hướng dùng chung cho khu vực Hội viên và staff shell.
// Các route được gom theo workflow nhưng vẫn giữ nguyên URL và role guard.

import { ROLES } from '../../constants';

export const APP_SHELL_NAV_ITEMS = {
  [ROLES.RECEPTIONIST]: [
    {
      label: 'Tổng quan',
      items: [{ to: '/reception/dashboard', label: 'Trang tổng quan' }],
    },
    {
      label: 'Vận hành tại quầy',
      items: [
        { to: '/reception/check-in', label: 'Check-in trung tâm' },
        { to: '/reception/center-visits', label: 'Lượt vào đang mở' },
      ],
    },
    {
      label: 'Quản lý hội viên',
      items: [
        { to: '/reception/members', label: 'Tra cứu hội viên' },
        { to: '/reception/members/new', label: 'Đăng ký hội viên' },
      ],
    },
    {
      label: 'Gói tập và thanh toán',
      items: [
        { to: '/reception/membership-offers', label: 'Gói tập' },
        { to: '/reception/orders/new', label: 'Tạo đơn gói tập' },
        { to: '/reception/payments/reconcile', label: 'Đối soát' },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { to: '/reception/notifications', label: 'Thông báo' },
        { to: '/reception/profile', label: 'Hồ sơ cá nhân' },
      ],
    },
  ],
  [ROLES.COACH]: [
    {
      label: 'Tổng quan',
      items: [{ to: '/coach/dashboard', label: 'Trang tổng quan' }],
    },
  ],
  [ROLES.MANAGER]: [
    {
      label: 'Tổng quan',
      items: [{ to: '/manager/dashboard', label: 'Trang tổng quan' }],
    },
    {
      label: 'Nhân sự và hội viên',
      items: [
        { to: '/manager/staff-accounts', label: 'Nhân viên & Quản lý' },
        { to: '/manager/members', label: 'Hội viên' },
        { to: '/manager/coach-assignments', label: 'Phân công HLV' },
      ],
    },
    {
      label: 'Vận hành lớp học',
      items: [
        { to: '/manager/disciplines', label: 'Bộ môn' },
        { to: '/manager/classes', label: 'Lớp học' },
        { to: '/manager/class-sessions', label: 'Buổi tập' },
        { to: '/manager/rooms', label: 'Phòng tập' },
      ],
    },
    {
      label: 'Kinh doanh',
      items: [
        { to: '/manager/membership-plans', label: 'Loại gói & quyền lợi' },
        { to: '/manager/membership-offers', label: 'Gói tập' },
        { to: '/manager/payments/reconcile', label: 'Đối soát' },
      ],
    },
    {
      label: 'Theo dõi hệ thống',
      items: [
        { to: '/manager/reports', label: 'Báo cáo chi tiết' },
        { to: '/manager/audit-events', label: 'Lịch sử hoạt động' },
        { to: '/manager/notifications', label: 'Thông báo' },
        { to: '/manager/profile', label: 'Hồ sơ cá nhân' },
      ],
    },
  ],
};

export function flattenNavSections(sections = []) {
  return sections.flatMap((section) => section.items ?? []);
}

// Mục user dropdown theo role. Member dropdown vẫn nằm inline trong AppShell
// (vì nó chứa "Đổi mật khẩu" — logic vai trò, không phải cấu hình).
export const APP_SHELL_USER_MENU = {
  [ROLES.MANAGER]: [
    { to: '/manager/dashboard', label: 'Trang tổng quan' },
    { to: '/manager/profile', label: 'Hồ sơ cá nhân' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/reception/dashboard', label: 'Trang tổng quan' },
    { to: '/reception/profile', label: 'Hồ sơ cá nhân' },
  ],
  [ROLES.COACH]: [
    { to: '/coach', label: 'Trang tổng quan' },
  ],
};

// Mục menu bên trái trong Member area. `to: null` nghĩa là chưa có trang -> làm mờ.
export const MEMBER_SIDEBAR_ITEMS = [
  {
    label: 'Tổng quan',
    items: [{ to: '/member/dashboard', label: 'Trang tổng quan', icon: 'dashboard' }],
  },
  {
    label: 'Lịch tập',
    items: [
      {
        to: '/member/class-booking',
        label: 'Đăng ký lớp',
        icon: 'clipboard',
        requiredBenefit: 'CLASS_BOOKING',
      },
      { to: '/member/class-sessions', label: 'Lịch của tôi', icon: 'calendar' },
    ],
  },
  {
    label: 'Huấn luyện cá nhân',
    items: [
      { to: '/member/training-plans', label: 'Giáo án tập luyện', icon: 'clipboard' },
      { to: '/member/training-results', label: 'Kết quả tập luyện', icon: 'dashboard' },
      { to: '/member/feedback', label: 'Nhận xét HLV', icon: 'profile' },
    ],
  },
  {
    label: 'Gói tập và thanh toán',
    items: [
      { to: '/member/plan', label: 'Gói tập hiện tại', icon: 'dumbbell' },
      { to: '/member/memberships', label: 'Lịch sử gói tập', icon: 'receipt' },
      { to: '/member/receipts', label: 'Biên lai', icon: 'receipt' },
    ],
  },
  {
    label: 'Tài khoản',
    items: [
      { to: '/member/notifications', label: 'Thông báo', icon: 'bell' },
      { to: '/member/profile', label: 'Hồ sơ cá nhân', icon: 'profile', end: true },
    ],
  },
];

// Nhãn khu vực + role chip cho khu vực staff.
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
