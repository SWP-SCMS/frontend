// Nội dung chữ cố định của trang bảng gói tập công khai (/offers).
//
// Sửa chữ ở đây, không cần động vào JSX. Nội dung bám theo Business Rules
// v4.2 (BR-PKG, BR-BKG, BR-PAY, BR-MEM): khi đổi chính sách, nhớ cập nhật lại
// cho khớp.

export const OFFERS_COPY = {
  eyebrow: 'Bảng gói tập niêm yết',
  title: 'Chọn gói tập phù hợp với mục tiêu của bạn',
  subtitle:
    'Giá niêm yết minh bạch, quyền lợi rõ ràng. Chọn loại gói và thời hạn phù hợp với mục tiêu tập luyện của bạn.',

  listTitle: 'Các gói tập',

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
    desc: 'Chọn gói có quyền đặt lớp để đăng ký các buổi tập ngay trên hệ thống.',
  },
];

// Câu hỏi thường gặp (BR-PAY-01, BR-MEM-05, BR-MEM-08, BR-BKG-05, BR-BKG-06).
export const FAQS = [
  {
    q: 'Tôi thanh toán gói tập bằng cách nào?',
    a: 'Hội viên tự mua gói thanh toán bằng chuyển khoản. Nếu bạn đến trực tiếp trung tâm, lễ tân có thể hỗ trợ tạo đơn và thu tiền mặt tại quầy.',
  },
  {
    q: 'Gói nào có thể đặt lớp Yoga, Group hoặc PT 1-1?',
    a: 'Bạn cần chọn gói đang mở bán có quyền đặt lớp phù hợp. Hệ thống sẽ kiểm tra quyền lợi của gói tại thời điểm đặt lịch.',
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
