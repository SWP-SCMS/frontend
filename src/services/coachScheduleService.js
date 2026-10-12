// API lịch phụ trách của Huấn luyện viên (COACH). BE chỉ trả các Session mà
// Coach đang đăng nhập là Teaching Coach (BR-SEC-04 do BE kiểm tra).
//
//   GET   /api/v1/coach/class-sessions                  danh sách (phân trang)
//   GET   /api/v1/coach/class-sessions/{id}             chi tiết + hội viên đã đặt
//   GET   /api/v1/coach/class-sessions/{id}/attendance  danh sách điểm danh
//   PATCH /api/v1/coach/class-sessions/{id}/attendance/{attendanceId}
//         body { status: 'PRESENT' | 'ABSENT' }
//
// Query của danh sách: from, to (ISO Instant), status, page, size.
// Item danh sách: id, classId, coachId, roomId, startTime, endTime,
// capacity, status (SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED).

import api from './api';

export async function listCoachSessions(params = {}) {
  const cleaned = {};
  if (params.from) cleaned.from = params.from;
  if (params.to) cleaned.to = params.to;
  if (params.status) cleaned.status = params.status;
  if (params.page != null) cleaned.page = params.page;
  if (params.size != null) cleaned.size = params.size;
  const { data } = await api.get('/coach/class-sessions', { params: cleaned });
  return data;
}

export async function getCoachSession(sessionId) {
  const { data } = await api.get(`/coach/class-sessions/${sessionId}`);
  return data;
}

export async function listSessionAttendance(sessionId) {
  const { data } = await api.get(
    `/coach/class-sessions/${sessionId}/attendance`,
  );
  return data;
}

export async function updateAttendance(sessionId, attendanceId, status) {
  const { data } = await api.patch(
    `/coach/class-sessions/${sessionId}/attendance/${attendanceId}`,
    { status },
  );
  return data;
}
