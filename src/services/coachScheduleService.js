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
// Item danh sách đã gồm className, classType, disciplineName, coachName,
// roomName và bookedCount ngoài dữ liệu lịch cơ bản.

import api from './api';
import { courseTeachingEntries } from '../utils/coachTeachingSchedule';

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

async function allSchedulePages(path, range) {
  const first = (await api.get(path, { params: { ...range, page: 0, size: 100 } })).data;
  const pages = await Promise.all(Array.from({ length: Math.max(0, (first.totalPages || 1) - 1) }, (_, index) =>
    api.get(path, { params: { ...range, page: index + 1, size: 100 } }).then(response => response.data)));
  return [first, ...pages].flatMap(page => page.content || []);
}

export async function listCoachTeachingSessions({ from, to }) {
  const [classes, courses] = await Promise.all([
    allSchedulePages('/coach/class-sessions', { from, to }),
    allSchedulePages('/coach/course-sessions', { from, to }),
  ]);
  return [...classes, ...courseTeachingEntries(courses)].sort((a, b) =>
    Date.parse(a.startTime) - Date.parse(b.startTime) || a.id.localeCompare(b.id));
}
