// Trạng thái điểm danh của một buổi tập đã đặt (dùng ở "Lịch của tôi").
//
// BE chưa trả `attendanceStatus` cho Hội viên (đã nhờ BE bổ sung). Khi có,
// giá trị là PRESENT hoặc ABSENT (BR-ATT-02/03, BR-LIM-09).

// Đã điểm danh khi attendanceStatus === 'PRESENT'; mọi trường hợp khác
// (ABSENT mặc định, chưa có dữ liệu) coi là chưa điểm danh.
export function isAttended(session) {
  return session?.attendanceStatus === 'PRESENT';
}
