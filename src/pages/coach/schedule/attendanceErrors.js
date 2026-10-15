// Đổi mã lỗi của API điểm danh thành câu tiếng Việt cho Coach.
// Mã lấy từ BE (AttendanceException): xử lý theo `code`, không parse `detail`.

const MESSAGES = {
  ATTENDANCE_WINDOW_CLOSED:
    'Đã hết thời gian điểm danh (hoặc buổi tập chưa bắt đầu).',
  CENTER_VISIT_REQUIRED:
    'Học viên chưa được lễ tân check-in nên chưa thể ghi "Có mặt".',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi tập này trong lịch của bạn.',
  VALIDATION_ERROR: 'Dữ liệu điểm danh không hợp lệ.',
};

// Trả về Error có message tiếng Việt nếu biết mã lỗi, không thì trả lại lỗi gốc.
export function toAttendanceError(err) {
  const message = MESSAGES[err?.response?.data?.code];
  return message ? new Error(message) : err;
}
