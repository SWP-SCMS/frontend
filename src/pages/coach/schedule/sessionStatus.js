// Nhãn + màu trạng thái Session, và quy tắc cho phép điểm danh.

export const SESSION_STATUS_LABELS = {
  SCHEDULED: { text: 'Sắp diễn ra', variant: 'primary' },
  IN_PROGRESS: { text: 'Đang diễn ra', variant: 'success' },
  COMPLETED: { text: 'Đã kết thúc', variant: 'secondary' },
  CANCELLED: { text: 'Đã hủy', variant: 'danger' },
};

const ATTENDANCE_GRACE_MS = 30 * 60 * 1000;

// Chỉ sửa điểm danh từ giờ bắt đầu đến trước endTime + 30 phút, và Session
// không bị hủy. BE vẫn là nơi kiểm tra thật; FE chỉ khóa nút cho rõ ràng.
export function canEditAttendance(session, now = Date.now()) {
  if (!session || session.status === 'CANCELLED') return false;
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  return now >= start && now < end + ATTENDANCE_GRACE_MS;
}
