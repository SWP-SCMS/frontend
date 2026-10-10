// Nội dung chữ cố định của trang bảng gói tập công khai (/offers).
//
// Sửa chữ ở đây, không cần động vào JSX. Nội dung bám theo Business Rules
// v4.2 (BR-PKG, BR-BKG, BR-PAY, BR-MEM): khi đổi chính sách, nhớ cập nhật lại
// cho khớp.

export const OFFERS_COPY = {
  eyebrow: 'Bảng gói tập niêm yết',
  title: 'Chọn gói tập phù hợp với mục tiêu của bạn',
  subtitle:
    'Giá niêm yết minh bạch, quyền lợi rõ ràng. Hai gói cố định BASIC và PLUS với nhiều thời hạn để bạn tự do lựa chọn mức đồng hành phù hợp.',

  listTitle: 'Các gói tập',

  compareEyebrow: 'So sánh quyền lợi',
  compareTitle: 'BASIC hay PLUS: khác nhau ở đâu?',

  faqEyebrow: 'Giải đáp nhanh',
  faqTitle: 'Câu hỏi thường gặp',
};

// Ba điểm tin cậy ở đầu trang.
export const TRUST_POINTS = [
  {
    icon: 'shield',
    title: 'Giá minh bạch',
    desc: 'Giá hiển thị là giá thanh toán, không phụ phí ẩn.',
  },
  {
    icon: 'card',
    title: 'Thanh toán linh hoạt',
    desc: 'Chuyển khoản trực tuyến hoặc tiền mặt tại quầy lễ tân.',
  },
  {
    icon: 'calendar',
    title: 'Đặt lịch dễ dàng',
    desc: 'Gói PLUS đặt lớp Yoga, Group và PT 1-1 ngay trên hệ thống.',
  },
];

// Bảng so sánh BASIC / PLUS (BR-PKG-01, BR-PKG-02, BR-COA-01).
export const COMPARE_ROWS = [
  { label: 'Sử dụng khu vực gym & tập luyện tại trung tâm', basic: true, plus: true },
  { label: 'Đặt lịch lớp Yoga / Group', basic: false, plus: true },
  { label: 'Đặt lịch PT 1-1', basic: false, plus: true },
  { label: 'Personal Coach, kế hoạch và kết quả tập luyện', basic: false, plus: true },
];

// Câu hỏi thường gặp (BR-PAY-01, BR-MEM-05, BR-MEM-08, BR-BKG-05, BR-BKG-06).
export const FAQS = [
  {
    q: 'Tôi thanh toán gói tập bằng cách nào?',
    a: 'Hội viên tự mua gói thanh toán bằng chuyển khoản. Nếu bạn đến trực tiếp trung tâm, lễ tân có thể hỗ trợ tạo đơn và thu tiền mặt tại quầy.',
  },
  {
    q: 'Gói BASIC có đặt được lớp Yoga, Group hoặc PT 1-1 không?',
    a: 'Không. Gói BASIC dành cho việc sử dụng khu vực gym và tập luyện. Muốn đặt lịch lớp Yoga, Group hoặc PT 1-1 bạn cần gói PLUS còn hiệu lực.',
  },
  {
    q: 'Khi gói đang còn hạn, tôi có mua thêm gói mới được không?',
    a: 'Chưa được. Bạn chỉ mua gói mới sau khi gói hiện tại hết hạn, và mỗi lần chỉ có một đơn chờ thanh toán.',
  },
  {
    q: 'Gói tập đã hết hạn có kích hoạt lại được không?',
    a: 'Không. Gói hết hạn được lưu làm lịch sử. Để tiếp tục sử dụng dịch vụ, bạn chọn một gói mới và thanh toán lại.',
  },
  {
    q: 'Tôi có thể hủy lịch tập đã đặt không?',
    a: 'Được, nếu còn ít nhất 2 giờ trước giờ bắt đầu buổi tập. Hủy xong, chỗ của bạn được nhường cho hội viên khác.',
  },
];
