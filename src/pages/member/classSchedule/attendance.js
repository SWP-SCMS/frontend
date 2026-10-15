// Trạng thái điểm danh của một buổi tập đã đặt (dùng ở "Lịch của tôi").
//
// BE chưa trả `attendanceStatus` cho Hội viên (đã nhờ BE bổ sung). Khi có,
// giá trị là PRESENT hoặc ABSENT (BR-ATT-02/03, BR-LIM-09).

// Đã điểm danh khi attendanceStatus === 'PRESENT'; mọi trường hợp khác
// (ABSENT mặc định, chưa có dữ liệu) coi là chưa điểm danh.
export function isAttended(session) {
  return session?.attendanceStatus === 'PRESENT';
}

// Điểm danh chính thức chốt sau endTime + 30 phút (BR-ATT-06/07): trước mốc này
// ABSENT chỉ là mặc định tạm và Coach vẫn có thể đổi sang PRESENT.
const ATTENDANCE_LOCK_MS = 30 * 60 * 1000;

// Trạng thái hiển thị của một buổi tập đã đặt:
//   'present' -> "Đã điểm danh" (PRESENT)
//   'absent'  -> "Vắng" (quá hạn điểm danh mà vẫn chưa PRESENT)
//   'pending' -> "Chưa điểm danh"
export function getAttendanceDisplay(session, now = Date.now()) {
  if (isAttended(session)) return { key: 'present', text: 'Đã điểm danh' };
  const end = new Date(session?.endTime).getTime();
  if (Number.isFinite(end) && now >= end + ATTENDANCE_LOCK_MS) {
    return { key: 'absent', text: 'Vắng' };
  }
  return { key: 'pending', text: 'Chưa điểm danh' };
}
