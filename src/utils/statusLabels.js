export const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', SUSPENDED: 'Tạm khóa',
  ARCHIVED: 'Đã lưu trữ', DRAFT: 'Bản nháp', PENDING: 'Chờ xử lý',
  PENDING_PAYMENT: 'Chờ thanh toán', PAID: 'Đã thanh toán', EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn thành', RESERVED: 'Chờ kích hoạt',
  TERMINATED: 'Đã chấm dứt', FAILED: 'Không hợp lệ',
};
export function statusLabel(value) { return STATUS_LABELS[value] || 'Chưa xác định'; }
