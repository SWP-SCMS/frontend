import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useRef, useState } from 'react';
import { Alert, Button, Modal, Table } from 'react-bootstrap';
import { listCoachCourseSessions, getCoachCourseSession, getCoachCourseRoster, updateCourseAttendance } from '../../../services/courseCoachService';
import { formatCourseDateTime, getCourseErrorMessage, COURSE_SESSION_STATUS_LABELS, COURSE_ATTENDANCE_STATUS_LABELS } from '../../../utils/courseUi';
const reasons = { WRITABLE: 'Đang trong thời gian điểm danh', TOO_EARLY: 'Chưa đến giờ điểm danh', WINDOW_CLOSED: 'Đã hết giờ điểm danh', SESSION_CANCELLED: 'Buổi học không cho phép điểm danh', NOT_ASSIGNED_COACH: 'Bạn không được phân công', COURSE_RUN_NOT_ACTIVE: 'Đợt học chưa hoạt động' };
export default function CoachCourseSessionsPage() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [roster, setRoster] = useState([]);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useCachedPollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true; if (!background) commitValue(setData, null); commitError(setError, '');
    track(listCoachCourseSessions(page).then((value) => { if (active) commitValue(setData, value); }).catch((e) => { failed(e);  if (active) commitError(setError, getCourseErrorMessage(e, 'Không tải được lịch khóa học.')); }));
    return () => { active = false; };
  }, [page, revision], { key: ['coach-course-sessions', page], setters: [setData] }, !busy);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true; if (!background) commitValue(setDetail, null); if (!background) commitValue(setRoster, []); commitError(setDetailError, '');
    if (selected) track(Promise.all([getCoachCourseSession(selected), getCoachCourseRoster(selected)]).then(([session, students]) => { if (active) { commitValue(setDetail, session); commitValue(setRoster, students); } }).catch((e) => { failed(e);  if (active) commitError(setDetailError, getCourseErrorMessage(e, 'Không tải được danh sách học viên.')); }));
    return () => { active = false; };
  }, [selected, revision], !busy);
  async function mark(row, status) {
    if (lock.current || !detail?.attendanceWritable) return;
    lock.current = true; setBusy(true); setDetailError('');
    try {
      const updated = await updateCourseAttendance(selected, row.enrollmentSessionId, status);
      setRoster((rows) => rows.map((item) => item.enrollmentSessionId === updated.enrollmentSessionId ? updated : item));
    } catch (e) { setDetail(null); setDetailError(getCourseErrorMessage(e, 'Không ghi nhận được điểm danh. Tải lại trước khi thử tiếp.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="container-fluid py-4"><h1 className="h3">Buổi khóa học được phân công</h1><Button disabled={busy} onClick={() => setRevision((v) => v + 1)}>Tải lại</Button>
    {error && <Alert variant="danger">{error}</Alert>}
    {!data && !error ? <p>Đang tải…</p> : data && <><Table responsive><thead><tr><th>Khóa học / đợt</th><th>Buổi</th><th>Lịch</th><th>Phòng</th><th>Trạng thái</th><th /></tr></thead><tbody>{data.content.map((item) => <tr key={item.courseSessionId}><td>{item.courseName} · {item.runCode}</td><td>{item.unitNumber}</td><td>{formatCourseDateTime(item.startsAt)} – {formatCourseDateTime(item.endsAt)}</td><td>{item.roomName}</td><td>{COURSE_SESSION_STATUS_LABELS[item.sessionStatus] || 'Chưa xác định'}</td><td><Button onClick={() => setSelected(item.courseSessionId)}>Học viên / điểm danh ({item.rosterCount})</Button></td></tr>)}</tbody></Table>{!data.content.length && <p>Chưa có buổi khóa học được phân công.</p>}</>}
    <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button><span className="mx-3">Trang {page + 1}</span><Button disabled={!data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button>
    <Modal show={!!selected} onHide={() => { if (!busy) setSelected(null); }} size="lg" backdrop={busy ? 'static' : true} keyboard={!busy}><Modal.Header closeButton={!busy}><Modal.Title>Học viên khóa học</Modal.Title></Modal.Header><Modal.Body>
      {detailError && <Alert variant="danger">{detailError}</Alert>}
      <Button disabled={busy} onClick={() => setRevision((v) => v + 1)}>Tải lại danh sách</Button>
      {!detail && !detailError && <p>Đang tải…</p>}
      {detail && <><p>{detail.courseName} · {detail.runCode} · Buổi {detail.unitNumber}</p><p>{reasons[detail.attendanceWriteReason] || 'Chưa xác định quyền điểm danh'}</p><Table responsive><thead><tr><th>Hội viên</th><th>Điểm danh</th><th /></tr></thead><tbody>{roster.map((row) => <tr key={row.enrollmentSessionId}><td>{row.fullName} · {row.memberCode}</td><td>{COURSE_ATTENDANCE_STATUS_LABELS[row.attendanceStatus] || 'Chưa ghi nhận'}</td><td>{['PRESENT', 'ABSENT'].map((status) => <Button className="me-2" key={status} disabled={busy || !detail.attendanceWritable || row.attendanceStatus === status} onClick={() => mark(row, status)}>{COURSE_ATTENDANCE_STATUS_LABELS[status]}</Button>)}</td></tr>)}</tbody></Table>{!roster.length && <p>Chưa có học viên.</p>}</>}
    </Modal.Body></Modal>
  </div>;
}
