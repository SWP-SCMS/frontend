export const COURSE_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
  INACTIVE: 'Ngừng hoạt động',
  ARCHIVED: 'Đã lưu trữ',
};

export const COURSE_RUN_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  OPEN_FOR_REGISTRATION: 'Đang mở đăng ký',
  CONFIRMED: 'Đã xác nhận mở lớp',
  IN_PROGRESS: 'Đang diễn ra',
  SETTLEMENT_PENDING: 'Chờ quyết toán',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const COURSE_REGISTRATION_STATUS_LABELS = {
  UPCOMING: 'Sắp mở đăng ký',
  OPEN: 'Đang mở đăng ký',
  CLOSED: 'Đã đóng đăng ký',
};

export const COURSE_SESSION_STATUS_LABELS = {
  SCHEDULED: 'Đã lên lịch',
  CANCELLED_PENDING_MAKEUP: 'Đã hủy, chờ học bù',
  MAKEUP_SCHEDULED: 'Đã xếp lịch học bù',
  COMPLETED: 'Đã hoàn thành',
  UNRESOLVED: 'Chưa xử lý',
  RESOLVED_BY_REFUND: 'Đã xử lý bằng hoàn tiền',
};

export const COURSE_ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  EXPIRED: 'Đã hết hạn',
  PAID: 'Đã thanh toán',
};

export const COURSE_WAITLIST_STATUS_LABELS = {
  WAITING: 'Đang chờ',
  INVITED: 'Được mời đăng ký',
  ACCEPTED: 'Đã chấp nhận',
  LEFT: 'Đã rời hàng chờ',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
};

export const COURSE_ATTENDANCE_STATUS_LABELS = {
  NOT_RECORDED: 'Chưa điểm danh',
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng mặt',
};

export function getCourseStatusLabel(map, status) {
  return map?.[status] ?? 'Chưa có thông tin';
}

export function formatCourseMoney(value, currencyCode = 'VND') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCourseDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

const COURSE_ERROR_MESSAGES = {
  COURSE_VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.',
  COURSE_RUN_CHANGED: 'Đợt học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_CHANGED: 'Khóa học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_SESSION_CHANGED: 'Buổi học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_RUN_INVALID_TRANSITION: 'Không thể thực hiện thao tác ở trạng thái hiện tại của đợt học.',
  COURSE_RUN_INVALID_OPENING: 'Kiểm tra học phí, sĩ số, lịch học và chính sách trước khi mở đăng ký.',
  COURSE_SESSION_RESOURCE_CONFLICT: 'Phòng hoặc huấn luyện viên đã có lịch vào thời gian này.',
  COURSE_SESSION_ROOM_CAPACITY_CONFLICT: 'Sĩ số đợt học vượt sức chứa của phòng.',
  COURSE_SESSION_DISRUPTION_CONFLICT: 'Buổi học không còn ở trạng thái cho phép hủy hoặc xếp bù.',
  COURSE_SCHEDULE_CHANGE_DEADLINE_UNAVAILABLE: 'Lịch mới không còn đủ thời gian để học viên phản hồi.',
  COURSE_SCHEDULE_CHANGE_RESPONSE_CLOSED: 'Đã hết thời hạn phản hồi thay đổi lịch.',
  COURSE_SCHEDULE_CHANGE_RESPONSE_CONFLICT: 'Bạn đã gửi phản hồi khác cho thay đổi này.',

  COURSE_IDEMPOTENCY_KEY_REQUIRED: 'Thiếu mã xác nhận thao tác. Vui lòng thử lại.',
  COURSE_IDEMPOTENCY_KEY_REUSED: 'Yêu cầu này đã được xử lý. Vui lòng tải lại trang.',
  COURSE_RUN_NOT_AVAILABLE: 'Đợt học này hiện không còn khả dụng.',
  MEMBER_NOT_FOUND: 'Không tìm thấy thông tin hội viên.',
  MEMBER_NOT_ACTIVE: 'Tài khoản hội viên chưa hoạt động.',
  COURSE_REGISTRATION_NOT_OPEN: 'Đợt học này chưa mở đăng ký.',
  COURSE_REGISTRATION_CLOSED: 'Đợt học này đã đóng đăng ký.',
  COURSE_RESERVATION_EXISTS: 'Bạn đang có một đơn giữ chỗ cho đợt học này.',
  COURSE_MEMBER_ALREADY_ENROLLED: 'Bạn đã đăng ký đợt học này.',
  COURSE_CAPACITY_FULL: 'Đợt học đã đủ chỗ. Bạn có thể tham gia danh sách chờ.',
  COURSE_SCHEDULE_CONFLICT: 'Lịch học của khóa này trùng với lịch hiện có của bạn.',
  COURSE_ORDER_NOT_FOUND: 'Không tìm thấy đơn đăng ký khóa học.',
};

export function getCourseErrorCode(error) {
  const data = error?.response?.data;
  return data?.code || data?.errorCode || data?.error || error?.code || '';
}

export function getCourseErrorMessage(error, fallback = 'Không thể xử lý yêu cầu. Vui lòng thử lại.') {
  const code = getCourseErrorCode(error);
  return COURSE_ERROR_MESSAGES[code] || fallback;
}

export const COURSE_ENROLLMENT_STATUS_LABELS = {
  ACTIVE: 'Đang theo học', TRANSFERRED: 'Đã chuyển đợt học',
  COMPLETED: 'Đã hoàn thành', WITHDRAWAL_PENDING: 'Chờ xử lý yêu cầu rút', WITHDRAWN: 'Đã rút',
};
export const COURSE_DISPOSITION_LABELS = {
  ENROLLED: 'Có suất học', NOT_ENROLLED: 'Không có suất học', UNRESOLVED: 'Chờ xử lý buổi học',
};
