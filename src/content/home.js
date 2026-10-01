// Static marketing content for the public HomePage.
//
// Everything you see on the homepage outside the hero copy and the
// "Xem gói tập" CTA lives here. Centralising it makes it trivial to
// tweak wording, swap plan names, or add/remove feature tiles without
// touching JSX.
//
// When the backend exposes `/public/landing/plans`,
// `/public/landing/features`, etc., swap the imports below for a
// service call. The shape of the exported objects is what the future
// API is expected to return, so the JSX does not need to change.

import { MEMBERSHIP_PLAN } from '../constants';

export const HOMEPAGE_COPY = {
  planOverviewTitle: 'Chọn gói phù hợp với bạn',
  planOverviewSubtitle: 'Hai gói tập cố định, nhiều mức giá theo nhu cầu.',
  ctaTitle: 'Sẵn sàng bắt đầu?',
  ctaSubtitle:
    'Đăng ký hôm nay để trải nghiệm hệ thống quản lý phòng tập hiện đại.',
  ctaPrimary: 'Đăng ký hội viên',
  heroPrimary: 'Đăng ký hội viên',
  heroSecondary: 'Xem gói tập',
};

export const PLAN_OVERVIEW = [
  {
    code: MEMBERSHIP_PLAN.BASIC,
    title: 'BASIC',
    tagline: 'Tập luyện nền tảng',
    bullets: [
      'Ra vào trung tâm không giới hạn',
      'Sử dụng khu vực tập tự do',
      'Tủ đồ cá nhân & nước uống miễn phí',
    ],
    highlight: false,
  },
  {
    code: MEMBERSHIP_PLAN.PLUS,
    title: 'PLUS',
    tagline: 'Trọn gói luyện tập & cá nhân hóa',
    bullets: [
      'Toàn bộ quyền lợi của BASIC',
      'Đặt lịch Group / Yoga',
      'Đặt lịch PT 1-1 với HLV',
      'Theo dõi mục tiêu cùng Personal Coach',
    ],
    highlight: true,
  },
];

export const FEATURES = [
  {
    title: 'Đăng ký dễ dàng',
    desc: 'Tạo tài khoản hội viên trong vài phút.',
  },
  {
    title: 'Thanh toán rõ ràng',
    desc: 'Theo dõi đơn hàng, biên lai, lịch sử giao dịch.',
  },
  {
    title: 'Đặt lịch linh hoạt',
    desc: 'Group/Yoga & PT 1-1 cho gói PLUS.',
  },
  {
    title: 'Điểm danh minh bạch',
    desc: 'HLV xác nhận Presence tại mỗi buổi tập.',
  },
];
