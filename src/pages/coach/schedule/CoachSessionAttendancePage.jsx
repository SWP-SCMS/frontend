// /coach/schedule/:sessionId/attendance — điểm danh học viên.
//
// Mỗi học viên có 2 ô tích: "Có mặt" (PRESENT) hoặc "Vắng" (ABSENT); chỉ chọn
// được một. Chọn xong bấm "Lưu" để gửi các thay đổi:
//   PATCH /coach/class-sessions/{sessionId}/attendance/{attendanceId}
//   body { status: 'PRESENT' | 'ABSENT' }
// Quy tắc: chỉ sửa từ startTime đến endTime + 30 phút (BR-ATT-04..06); ghi
// PRESENT cần Center Visit (BR-VAL-ATT-02, BE kiểm tra và trả lỗi).

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import Icon from '../../../components/layout/MemberIcon';
import { updateAttendance } from '../../../services/coachScheduleService';
import { toAttendanceError } from './attendanceErrors';
import SessionSummary from './SessionSummary';
import { useCoachSession } from './useCoachSession';
import './CoachSchedulePage.css';

// Ảnh hồ sơ học viên; chưa có ảnh hoặc ảnh lỗi thì hiện biểu tượng người.
function Avatar({ url }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <span className="scms-coach-avatar" aria-hidden="true">
        <Icon name="user" size={22} />
      </span>
    );
  }
  return (
    <img
      className="scms-coach-avatar"
      src={url}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

export default function CoachSessionAttendancePage() {
  const { sessionId } = useParams();
  const {
    session,
    setAttendance,
    attendanceByMember,
    editable,
    loading,
    error,
    setError,
  } = useCoachSession(sessionId);

  // Lựa chọn chưa lưu: { [attendanceId]: 'PRESENT' | 'ABSENT' }.
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Trạng thái đang hiển thị = lựa chọn chưa lưu, nếu không có thì giá trị đã lưu.
  function currentStatus(record) {
    return draft[record.id] ?? record.status;
  }

  function choose(record, status) {
    setSaved(false);
    setDraft((d) => {
      const next = { ...d };
      // Chọn lại đúng giá trị đã lưu thì bỏ khỏi danh sách thay đổi.
      if (status === record.status) delete next[record.id];
      else next[record.id] = status;
      return next;
    });
  }

  const changedCount = Object.keys(draft).length;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const remaining = { ...draft };
    try {
      // Gửi lần lượt từng thay đổi; lỗi ở đâu thì dừng ở đó, phần đã lưu
      // được giữ lại và phần còn lại vẫn nằm trong danh sách chưa lưu.
      for (const [attendanceId, status] of Object.entries(draft)) {
        const updated = await updateAttendance(sessionId, attendanceId, status);
        setAttendance((list) =>
          list.map((a) => (a.id === attendanceId ? { ...a, ...updated } : a)),
        );
        delete remaining[attendanceId];
      }
      setSaved(true);
    } catch (err) {
      setError(toAttendanceError(err));
    } finally {
      setDraft(remaining);
      setSaving(false);
    }
  }

  return (
    <div className="scms-coach-page">
      <h1 className="h3 fw-bold mb-3">Điểm danh</h1>

      <ErrorAlert
        error={error}
        title="Có lỗi xảy ra"
        onClose={() => setError(null)}
      />
      {saved ? (
        <Alert variant="success" dismissible onClose={() => setSaved(false)}>
          Đã lưu điểm danh.
        </Alert>
      ) : null}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" size="sm" /> Đang tải...
        </div>
      ) : session ? (
        <>
          <SessionSummary session={session} />

          {!editable ? (
            <p className="text-muted small">
              Chỉ điểm danh được từ lúc buổi tập bắt đầu đến 30 phút sau khi
              kết thúc.
            </p>
          ) : null}

          {/* BR-VAL-ATT-02, BR-VIS-06: PRESENT cần Center Visit (lễ tân check-in). */}
          <p className="text-muted small">
            Lưu ý: chỉ ghi được &quot;Có mặt&quot; cho học viên đã được lễ tân
            check-in trước đó. Nếu học viên có mặt nhưng khi bấm Lưu hệ thống báo
            chưa check-in, vui lòng báo với lễ tân.
          </p>

          {session.members?.length ? (
            <div className="scms-coach-card mb-3">
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Mã HV</th>
                    <th>Họ tên</th>
                    <th>Điểm danh</th>
                  </tr>
                </thead>
                <tbody>
                  {session.members.map((m) => {
                    const record = attendanceByMember.get(m.memberId);
                    const status = record ? currentStatus(record) : null;
                    return (
                      <tr key={m.memberId}>
                        <td>
                          <Avatar url={m.profileImageUrl} />
                        </td>
                        <td>{m.memberCode}</td>
                        <td>{m.fullName}</td>
                        <td>
                          {/* Luôn hiện 2 ô tích; chưa có bản ghi (chưa tới giờ
                              điểm danh) thì khóa. */}
                          <div className="d-flex gap-3">
                            <Form.Check
                              type="checkbox"
                              id={`att-present-${m.memberId}`}
                              label="Có mặt"
                              checked={status === 'PRESENT'}
                              disabled={!editable || saving || !record?.id}
                              onChange={() => choose(record, 'PRESENT')}
                            />
                            <Form.Check
                              type="checkbox"
                              id={`att-absent-${m.memberId}`}
                              label="Vắng"
                              checked={status === 'ABSENT'}
                              disabled={!editable || saving || !record?.id}
                              onChange={() => choose(record, 'ABSENT')}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="scms-coach-empty mb-3">
              Chưa có học viên đăng ký.
            </div>
          )}

          <div className="d-flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={handleSave}
              disabled={!editable || saving || changedCount === 0}
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
            <Button
              as={Link}
              to="/coach/schedule"
              variant="outline-secondary"
            >
              Quay lại lịch phụ trách
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
