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
  return map?.[status] ?? status ?? '—';
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
