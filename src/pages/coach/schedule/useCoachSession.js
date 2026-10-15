// Hook dùng chung cho 3 trang của một buổi dạy (chi tiết / học viên / điểm danh).
//
// - GET /coach/class-sessions/{id}            : thông tin buổi + học viên đã đặt
// - GET /coach/class-sessions/{id}/attendance : điểm danh. BE chỉ từ chối khi
//   buổi CHƯA bắt đầu (ATTENDANCE_WINDOW_CLOSED); từ startTime trở đi vẫn đọc
//   được, kể cả sau khi khóa (BR-ATT-06 chỉ khóa việc SỬA). Nên tải khi buổi
//   đã bắt đầu.

import { useEffect, useMemo, useState } from 'react';
import {
  getCoachSession,
  listSessionAttendance,
} from '../../../services/coachScheduleService';
import { canEditAttendance } from './sessionStatus';

export function useCoachSession(sessionId) {
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // "Bây giờ" cập nhật mỗi 30 giây để nút điểm danh tự mở / khóa đúng giờ.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCoachSession(sessionId)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const editable = canEditAttendance(session, now);
  const started = session != null && now >= new Date(session.startTime).getTime();

  // Tải điểm danh khi buổi vừa bắt đầu.
  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    listSessionAttendance(sessionId)
      .then((data) => {
        if (!cancelled) setAttendance(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [started, sessionId]);

  // Ghép điểm danh vào danh sách hội viên theo memberId.
  const attendanceByMember = useMemo(() => {
    const map = new Map();
    attendance.forEach((a) => map.set(a.memberId, a));
    return map;
  }, [attendance]);

  return {
    session,
    attendance,
    setAttendance,
    attendanceByMember,
    editable,
    started,
    loading,
    error,
    setError,
  };
}
