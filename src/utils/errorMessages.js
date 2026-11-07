const SYSTEM_ERROR = 'Đã có lỗi hệ thống. Vui lòng thử lại sau; nếu lỗi lặp lại, hãy liên hệ quản lý.';
const MESSAGES = {
  MEMBER_NOT_FOUND: 'Không tìm thấy hội viên. Vui lòng kiểm tra lại thông tin.',
  INTERNAL_ERROR: SYSTEM_ERROR,
  EMAIL_ALREADY_EXISTS: 'Email này đã được sử dụng.',
  PHONE_ALREADY_EXISTS: 'Số điện thoại này đã được sử dụng.',
  ACTIVE_MEMBERSHIP_EXISTS: 'Hội viên đã có gói tập đang hoạt động.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.',
  ACTOR_NOT_ACTIVE_COACH: 'Tài khoản huấn luyện viên không còn quyền thực hiện thao tác này.',
  PLUS_MEMBERSHIP_REQUIRED: 'Gói tập của hội viên không có quyền lợi ghi kết quả hoặc nhận xét tại thời điểm buổi tập.',
  COACH_ASSIGNMENT_NOT_FOUND: 'Không tìm thấy phân công huấn luyện phù hợp.',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi tập trong phạm vi phụ trách của bạn.',
  SESSION_TRAINING_NOT_AVAILABLE: 'Chỉ có thể ghi kết quả và nhận xét sau khi buổi tập kết thúc và chưa bị hủy.',
  SESSION_MEMBER_NOT_FOUND: 'Hội viên không có đăng ký hợp lệ trong buổi tập này.',
  TRAINING_RESULT_NOT_FOUND: 'Không tìm thấy kết quả tập luyện. Vui lòng tải lại dữ liệu.',
  TRAINING_FEEDBACK_NOT_FOUND: 'Không tìm thấy nhận xét. Vui lòng tải lại dữ liệu.',
};
const STATUS_MESSAGES = {
  400: 'Thông tin gửi chưa hợp lệ. Vui lòng kiểm tra lại.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu được yêu cầu.',
  409: 'Dữ liệu đã thay đổi hoặc thao tác chưa phù hợp với trạng thái hiện tại. Vui lòng tải lại.',
  422: 'Thông tin gửi chưa hợp lệ. Vui lòng kiểm tra lại.',
  429: MESSAGES.RATE_LIMITED,
};

export function extractErrorMessage(error, fallback = SYSTEM_ERROR) {
  if (!error) return fallback;
  const code = error.response?.data?.code;
  if (Object.hasOwn(MESSAGES, code)) return MESSAGES[code];
  // Không hiển thị detail/message của HTTP: có thể chứa mã lỗi, SQL hoặc stack trace.
  if (error.response) {
    const status = error.response.status;
    return status >= 500 ? SYSTEM_ERROR : STATUS_MESSAGES[status] || fallback;
  }
  if (error.isAxiosError || error.request) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  const message = typeof error === 'string' ? error.trim() : error.message?.trim();
  if (Object.hasOwn(MESSAGES, message)) return MESSAGES[message];
  // Giữ thông báo tiếng Việt do các màn hình nghiệp vụ đã ánh xạ.
  return message && /[\u0080-\uffff]/.test(message) ? message : fallback;
}
