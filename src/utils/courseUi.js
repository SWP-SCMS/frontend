export const COURSE_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  REJECTED: 'Đã từ chối',
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
  CANCELLED: 'Đã hủy',
  REMOVED_BY_RUN_CHANGE: 'Đã bỏ do giảm số buổi',
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
  if (value == null || value === '' || typeof value === 'boolean') return '—';
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '—';
  const text = String(value);
  if (!/^-?\d{1,19}$/.test(text)) return '—';
  const amount = BigInt(text);
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
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

const COURSE_ERROR_MESSAGES = {
  COURSE_APPROVAL_ALREADY_DECIDED: 'Khóa học đã được xử lý. Vui lòng tải lại hàng chờ.',
  COURSE_SCHEDULE_CHANGE_RESPONSE_CLOSED: 'Đã hết thời hạn phản hồi hoặc thay đổi không còn khả dụng.',
  COURSE_SCHEDULE_CHANGE_RESPONSE_CONFLICT: 'Bạn đã gửi phản hồi khác. Vui lòng tải lại dữ liệu.',
  COURSE_SCHEDULE_CHANGE_DEADLINE_UNAVAILABLE: 'Lịch mới không còn đủ thời gian để hội viên phản hồi.',
  COURSE_SESSION_DISRUPTION_CONFLICT: 'Buổi học không còn cho phép hủy hoặc xếp bù. Vui lòng tải lại lịch.',

  COURSE_REFUND_INVALID: 'Thông tin hoàn tiền chưa hợp lệ. Kiểm tra lý do, số tiền và chứng từ.',
  COURSE_REFUND_NOT_FOUND: 'Không tìm thấy khoản hoàn tiền khả dụng. Vui lòng tải lại hàng chờ.',
  COURSE_REFUND_CHANGED: 'Khoản hoàn vừa được cập nhật. Tải lại hồ sơ trước khi xử lý tiếp.',
  COURSE_REFUND_ALREADY_DECIDED: 'Khoản hoàn đã được quyết định. Vui lòng tải lại hồ sơ.',
  COURSE_REFUND_ALREADY_DISBURSED: 'Khoản hoàn đã được ghi nhận chi. Vui lòng kiểm tra lại hồ sơ.',
  COURSE_REFUND_AMOUNT_EXCEEDS_AVAILABLE: 'Khoản hoàn vượt số tiền còn được phép hoàn sau các khoản đã duyệt trước đó.',
  COURSE_REFUND_AMOUNT_MISMATCH: 'Số tiền ghi nhận phải bằng số tiền đã duyệt.',
  COURSE_REFUND_EVIDENCE_MISMATCH: 'Số tiền hoặc mã chứng từ không khớp khoản chi đã ghi nhận.',
  COURSE_REFUND_DISBURSEMENT_NOT_ELIGIBLE: 'Khoản hoàn chưa đủ điều kiện chi. Đợt học phải hoàn thành trước khi ghi nhận chi.',
  COURSE_REFUND_IDEMPOTENCY_CONFLICT: 'Lần ghi nhận trước có thông tin khác. Tải lại hồ sơ để kiểm tra.',
  COURSE_REFUND_INVALID_TRANSITION: 'Trạng thái khoản hoàn không cho phép thao tác này. Tải lại hồ sơ.',
  COURSE_REFUND_SOURCE_CONFLICT: 'Nguồn hoàn tiền đã được ghi nhận với thông tin khác.',
  COURSE_TRANSFER_INVALID: 'Thông tin chuyển đợt chưa hợp lệ. Kiểm tra đợt học và lý do.',
  COURSE_TRANSFER_NOT_FOUND: 'Không tìm thấy yêu cầu chuyển đợt khả dụng.',
  COURSE_TRANSFER_ALREADY_DECIDED: 'Yêu cầu chuyển đợt đã được xử lý. Vui lòng tải lại.',
  COURSE_TRANSFER_TARGET_UNAVAILABLE: 'Đợt học thay thế không còn mở đăng ký.',
  COURSE_TRANSFER_TARGET_FULL: 'Đợt học thay thế đã hết chỗ.',
  COURSE_TRANSFER_TARGET_DUPLICATE: 'Hội viên đã có đăng ký ở đợt học thay thế.',
  COURSE_TRANSFER_TARGET_SCHEDULE_INVALID: 'Đợt học thay thế chưa có lịch đầy đủ. Quản lý cần kiểm tra lịch học.',
  COURSE_TRANSFER_SOURCE_INACTIVE: 'Đăng ký hiện tại không còn ở trạng thái cho phép chuyển.',
  COURSE_TRANSFER_SCHEDULE_CONFLICT: 'Đợt học thay thế trùng lịch học hoặc lịch tập của hội viên.',
  COURSE_TRANSFER_DEADLINE_UNAVAILABLE: 'Không còn đủ thời gian để chấp nhận đề nghị chuyển đợt.',
  COURSE_TRANSFER_OFFER_EXPIRED: 'Đề nghị chuyển đợt đã hết hạn.',
  COURSE_TRANSFER_OFFER_STALE: 'Giá trị chuyển đã thay đổi. Liên hệ quản lý để kiểm tra lại đề nghị.',
  COURSE_TRANSFER_IDEMPOTENCY_CONFLICT: 'Đề nghị đã được chấp nhận ở lần xử lý khác. Tải lại để xem kết quả hoặc đơn thanh toán.',
  COURSE_WAITLIST_CAPACITY_AVAILABLE: 'Đợt học còn chỗ. Bạn có thể đăng ký trực tiếp.',
  COURSE_WAITLIST_DUPLICATE: 'Bạn đã tham gia danh sách chờ của đợt học này.',
  COURSE_WAITLIST_INVITATION_EXPIRED: 'Lời mời đăng ký đã hết hạn. Vui lòng tải lại danh sách chờ.',
  COURSE_WAITLIST_NOT_FOUND: 'Không tìm thấy yêu cầu chờ của bạn.',
  COURSE_WAITLIST_UNAVAILABLE: 'Danh sách chờ này hiện không khả dụng.',
  COURSE_NOT_FOUND: 'Không tìm thấy khóa học.',
  COURSE_CODE_CONFLICT: 'Mã khóa học đã được sử dụng.',
  COURSE_INVALID_TRANSITION: 'Trạng thái khóa học không cho phép thao tác này.',
  COURSE_RUN_NOT_FOUND: 'Không tìm thấy đợt học.',
  COURSE_RUN_CODE_CONFLICT: 'Mã đợt học đã được sử dụng.',
  COURSE_RUN_IMMUTABLE: 'Đợt học đã mở đăng ký nên không thể sửa các thông tin đã chốt.',
  COURSE_SESSION_INVALID: 'Buổi học chưa hợp lệ hoặc đã có số thứ tự này. Kiểm tra thời gian, phòng và huấn luyện viên.',
  COURSE_SESSION_NOT_FOUND: 'Không tìm thấy buổi học.',
  COURSE_ATTENDANCE_CHANGED: 'Điểm danh đã được cập nhật. Vui lòng tải lại danh sách.',
  COURSE_ATTENDANCE_WINDOW_CLOSED: 'Đã ngoài thời gian cho phép điểm danh khóa học.',
  COURSE_SCHEDULE_CHANGE_NOT_FOUND: 'Không tìm thấy thay đổi lịch cần phản hồi.',
  COURSE_SCHEDULE_CHANGE_RESPONSE_INVALID: 'Lựa chọn phản hồi chưa hợp lệ.',
  COURSE_WITHDRAWAL_INVALID: 'Vui lòng nhập lý do hợp lệ, tối đa 1000 ký tự.',
  COURSE_WITHDRAWAL_NOT_FOUND: 'Không tìm thấy yêu cầu rút hoặc đăng ký khóa học.',
  COURSE_WITHDRAWAL_ALREADY_PENDING: 'Bạn đã có yêu cầu rút đang chờ duyệt. Kiểm tra lịch sử yêu cầu.',
  COURSE_WITHDRAWAL_ENROLLMENT_INACTIVE: 'Trạng thái đăng ký hiện tại không cho phép xin rút. Vui lòng tải lại dữ liệu.',
  COURSE_WITHDRAWAL_TRANSFER_OPEN: 'Đang có yêu cầu chuyển đợt học chưa xử lý xong.',
  COURSE_WITHDRAWAL_WINDOW_CLOSED: 'Đã hết thời gian xin rút vì buổi học cuối đã bắt đầu.',
  COURSE_WITHDRAWAL_INVALID_TRANSITION: 'Yêu cầu đã đổi trạng thái. Vui lòng tải lại dữ liệu.',

  COURSE_VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.',
  COURSE_RUN_CHANGED: 'Đợt học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_CHANGED: 'Khóa học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_SESSION_CHANGED: 'Buổi học vừa được cập nhật. Vui lòng tải lại trang.',
  COURSE_RUN_INVALID_TRANSITION: 'Không thể thực hiện thao tác ở trạng thái hiện tại của đợt học.',
  COURSE_RUN_INVALID_OPENING: 'Kiểm tra học phí, sĩ số, lịch học và chính sách trước khi mở đăng ký.',
  COURSE_SESSION_RESOURCE_CONFLICT: 'Phòng hoặc huấn luyện viên đã có lịch vào thời gian này.',
  COURSE_SESSION_ROOM_CAPACITY_CONFLICT: 'Sĩ số đợt học vượt sức chứa của phòng.',

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
