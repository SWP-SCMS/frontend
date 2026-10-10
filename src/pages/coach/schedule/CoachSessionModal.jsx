// Chi tiết một buổi tập của Coach: thông tin lớp + danh sách hội viên đã đặt
// + điểm danh (PRESENT / ABSENT).
//
// Phần "đánh giá học viên" chưa làm vì BE chưa có API Feedback cho Coach.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Modal, Spinner, Table } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getCoachSession,
  listSessionAttendance,
  updateAttendance,
} from '../../../services/coachScheduleService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import { SESSION_STATUS_LABELS, canEditAttendance } from './sessionStatus';

export default function CoachSessionModal({ sessionId, onHide }) {
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // id điểm danh đang gửi — khóa nút để tránh bấm hai lần.
  const [savingId, setSavingId] = useState(null);

  // Chỉ tải chi tiết buổi tập. Điểm danh tải riêng bên dưới.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await getCoachSession(sessionId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) load();
  }, [sessionId, load]);

  // Cập nhật "bây giờ" mỗi 30 giây để nút điểm danh tự mở / khóa đúng giờ
  // (BR-ATT-04..06) khi popup mở lâu.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const editable = canEditAttendance(session, now);

  // BE từ chối API điểm danh (ATTENDANCE_WINDOW_CLOSED) khi buổi chưa bắt đầu
  // hoặc đã quá hạn, nên chỉ tải khi đang trong khung giờ điểm danh. Tải lại
  // mỗi lần khung giờ vừa mở.
  useEffect(() => {
    if (!editable) return undefined;
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
  }, [editable, sessionId]);

  // Ghép điểm danh vào danh sách hội viên theo memberId.
  const attendanceByMember = useMemo(() => {
    const map = new Map();
    attendance.forEach((a) => map.set(a.memberId, a));
    return map;
  }, [attendance]);

  async function handleMark(record, status) {
    setSavingId(record.id);
    setError(null);
    try {
      const updated = await updateAttendance(sessionId, record.id, status);
      setAttendance((list) =>
        list.map((a) => (a.id === record.id ? { ...a, ...updated } : a)),
      );
    } catch (err) {
      setError(err);
    } finally {
      setSavingId(null);
    }
  }

  const statusInfo = session ? SESSION_STATUS_LABELS[session.status] : null;

  return (
    <Modal show={sessionId != null} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Chi tiết buổi tập</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ErrorAlert
          error={error}
          title="Có lỗi xảy ra"
          onClose={() => setError(null)}
        />

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" /> Đang tải...
          </div>
        ) : session ? (
          <>
            <div className="d-flex align-items-center gap-2 mb-3">
              <h2 className="h5 mb-0">{session.className}</h2>
              {statusInfo ? (
                <Badge bg={statusInfo.variant}>{statusInfo.text}</Badge>
              ) : null}
            </div>

            <dl className="row mb-3">
              <dt className="col-sm-3">Bộ môn</dt>
              <dd className="col-sm-9">{session.disciplineName || '—'}</dd>
              <dt className="col-sm-3">Ngày</dt>
              <dd className="col-sm-9">{formatGymDate(session.startTime)}</dd>
              <dt className="col-sm-3">Giờ</dt>
              <dd className="col-sm-9">
                {formatGymTime(session.startTime)} –{' '}
                {formatGymTime(session.endTime)}
              </dd>
              <dt className="col-sm-3">Phòng</dt>
              <dd className="col-sm-9">{session.roomName || '—'}</dd>
              <dt className="col-sm-3">Sĩ số</dt>
              <dd className="col-sm-9">
                {session.members?.length ?? 0} / {session.capacity}
              </dd>
              {session.status === 'CANCELLED' ? (
                <>
                  <dt className="col-sm-3">Lý do hủy</dt>
                  <dd className="col-sm-9">
                    {session.cancellationReason || '—'}
                  </dd>
                </>
              ) : null}
            </dl>

            <h3 className="h6">Danh sách học viên đã đăng ký</h3>
            {!editable && session.status !== 'CANCELLED' ? (
              <p className="text-muted small">
                Chỉ điểm danh được từ lúc buổi tập bắt đầu đến 30 phút sau khi
                kết thúc.
              </p>
            ) : null}

            {session.members?.length ? (
              <Table responsive hover size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th>Mã HV</th>
                    <th>Họ tên</th>
                    <th>SĐT</th>
                    <th>Điểm danh</th>
                  </tr>
                </thead>
                <tbody>
                  {session.members.map((m) => {
                    const record = attendanceByMember.get(m.memberId);
                    const busy = record && savingId === record.id;
                    return (
                      <tr key={m.memberId}>
                        <td>{m.memberCode}</td>
                        <td>{m.fullName}</td>
                        <td>{m.phone || '—'}</td>
                        <td>
                          {record ? (
                            <div className="d-flex gap-1">
                              <Button
                                size="sm"
                                variant={
                                  record.status === 'PRESENT'
                                    ? 'success'
                                    : 'outline-success'
                                }
                                disabled={
                                  !editable ||
                                  savingId != null ||
                                  record.status === 'PRESENT'
                                }
                                onClick={() => handleMark(record, 'PRESENT')}
                              >
                                {busy ? '...' : 'Có mặt'}
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  record.status === 'ABSENT'
                                    ? 'danger'
                                    : 'outline-danger'
                                }
                                disabled={
                                  !editable ||
                                  savingId != null ||
                                  record.status === 'ABSENT'
                                }
                                onClick={() => handleMark(record, 'ABSENT')}
                              >
                                Vắng
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted small">
                              {editable ? 'Chưa có dữ liệu' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <p className="text-muted">Chưa có học viên đăng ký.</p>
            )}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Đóng
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
