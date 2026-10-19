// Static marketing content for the public HomePage.
//
// Everything you see on the homepage outside the layout lives here.
// Centralising it makes it trivial to tweak wording, swap plan names, or
// add/remove feature tiles without touching JSX.
//
// When the backend exposes `/public/landing/plans`,
// `/public/landing/features`, etc., swap the imports below for a
// service call. The shape of the exported objects is what the future
// API is expected to return, so the JSX does not need to change.

export const HOMEPAGE_COPY = {
  badge: 'Hệ thống quản lý & rèn luyện thể thao thế hệ mới',
  heroTitleBefore: 'Nâng tầm thể chất với trải nghiệm tập luyện',
  heroTitleAccent: 'chuẩn mực',
  heroTitleAfter: 'và minh bạch.',
  heroDesc:
    'SCMS mang đến giải pháp tập luyện tối ưu cho hội viên và vận hành chuyên nghiệp: từ đăng ký gói tập linh hoạt, đặt lịch huấn luyện viên cá nhân 1-1, điểm danh tự động đến theo dõi chỉ số thể chất — tất cả được đồng bộ trên một nền tảng.',
  heroPrimary: 'Đăng ký trải nghiệm ngay',
  heroSecondary: 'Khám phá các gói tập',
  heroLogin: 'Đăng nhập hệ thống →',

  featuresEyebrow: 'Giá trị cốt lõi',
  featuresTitle: 'Vì sao hội viên chọn SCMS Sports Center?',
  featuresSubtitle:
    'Sự hòa quyện giữa không gian thẩm mỹ cao cấp và kỷ luật khoa học, được bảo chứng bằng dữ liệu rèn luyện thực tế.',

  planEyebrow: 'Bảng gói tập niêm yết',
  planTitle: 'Gói tập thiết kế riêng cho mục tiêu của bạn',
  planSubtitle:
    'Hai gói tập cố định minh bạch, quyền lợi rõ ràng, không phát sinh chi phí. Lựa chọn mức độ đồng hành phù hợp nhất với hành trình rèn luyện của bạn.',

  spaceEyebrow: 'Không gian thực tế',
  spaceTitle: 'Không gian truyền cảm hứng bứt phá',
};

export const FEATURES = [
  {
    icon: 'dumbbell',
    title: 'Không gian & Thiết bị hiện đại',
    desc: '100% thiết bị cơ học & tạ tay nhập khẩu chuẩn thi đấu Olympic. Phân khu công năng khoa học bao gồm Cardio Zone, Free Weights, Functional Training và khu phục hồi chuyên sâu.',
    note: 'Tiêu chuẩn vận hành 5 sao',
  },
  {
    icon: 'coach',
    title: 'Huấn luyện viên chuyên môn cao',
    desc: 'Lộ trình cá nhân hóa thiết kế riêng theo thể trạng từng cá nhân. Đo lường chỉ số InBody định kỳ, cố vấn dinh dưỡng định lượng nhằm đảm bảo hiệu quả chuyển đổi thể chất bền vững.',
    note: 'Kèm cặp 1-1 tối ưu hiệu năng',
  },
  {
    icon: 'unlock',
    title: 'Minh bạch & Chủ động 100%',
    desc: 'Mọi quyền lợi gói tập, lịch sử check-in, lịch tập cá nhân và thanh toán điện tử đều được kiểm soát minh bạch trên cổng tài khoản cá nhân. Cam kết tuyệt đối không phụ phí ẩn.',
    note: 'Rõ ràng trên mọi giao dịch',
  },
];

// Ảnh tự bỏ vào frontend/public/ với đúng tên file bên dưới.
export const SPACES = [
  {
    image: '/home-gym-1.jpg',
    eyebrow: 'Khu Tạ Nặng & Máy Kháng Lực',
    title: 'Trang thiết bị chuyên biệt tiêu chuẩn Olympic',
    desc: 'Bố trí rộng rãi, khoảng cách an toàn giữa các máy tập giúp tối ưu hóa luồng di chuyển và tập trung cao độ.',
    wide: true,
  },
  {
    image: '/home-gym-2.jpg',
    eyebrow: 'Khu Đón Tiếp & Tư Vấn',
    title: 'Tiếp đón chuyên nghiệp',
    desc: 'Quy trình check-in một chạm nhanh chóng, phòng tư vấn InBody riêng tư và chu đáo.',
    wide: false,
  },
];

export const FOOTER_INFO = {
  desc: 'SWP GYM - Sports Center Management System. Nền tảng quản lý và vận hành trung tâm thể thao tối tân, kiến tạo trải nghiệm rèn luyện đỉnh cao.',
  project: 'Dự án FPT University SWP391',
  address: '7 Đường D1, Tăng Nhơn Phú, Thành phố Hồ Chí Minh',
  hotline: 'Hotline: (+84) 24 7300 1866',
  email: 'Email: contact@scms-gym.vn',
  hoursDays: 'Thứ Hai - Chủ Nhật',
  hours: '06:00 - 22:00 hàng ngày',
  standard: 'Hệ thống vận hành tiêu chuẩn Athletic Enterprise',
};
