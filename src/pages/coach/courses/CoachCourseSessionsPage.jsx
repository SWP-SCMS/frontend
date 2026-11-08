import { Link, useSearchParams } from 'react-router-dom';
import SessionTime from '../../../components/common/SessionTime';
import Badge from '../../../components/common/SystemBadge';
import StaffPagination from '../../../components/common/StaffPagination';
import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useRef, useState } from 'react';
import { Alert, Button, Card, Modal, Table } from 'react-bootstrap';
import { listCoachCourseSessions, getCoachCourseSession, getCoachCourseRoster, updateCourseAttendance } from '../../../services/courseCoachService';
import { getCourseErrorMessage, COURSE_SESSION_STATUS_LABELS, COURSE_ATTENDANCE_STATUS_LABELS } from '../../../utils/courseUi';
const reasons = { WRITABLE: 'Đang trong thời gian điểm danh', TOO_EARLY: 'Chưa đến giờ điểm danh', WINDOW_CLOSED: 'Đã hết giờ điểm danh', SESSION_CANCELLED: 'Buổi học không cho phép điểm danh', NOT_ASSIGNED_COACH: 'Bạn không được phân công', COURSE_RUN_NOT_ACTIVE: 'Đợt học chưa hoạt động' };
export default function CoachCourseSessionsPage() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(() => params.get('session'));
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
  return <div className="scms-course-workspace"><div className="scms-course-header"><h1 className="h3 mb-0">Buổi khóa học được phân công</h1><Button variant="outline-secondary" disabled={busy} onClick={() => setRevision((v) => v + 1)}>Tải lại</Button></div>
    {error && <Alert variant="danger">{error}</Alert>}
    <Card className="border-0 shadow-sm"><Card.Body>
    {!data && !error ? <p>Đang tải…</p> : data && <><Table responsive hover className="align-middle scms-coach-course-table"><thead className="table-light"><tr><th>Khóa học / đợt</th><th>Buổi</th><th>Lịch</th><th>Phòng</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead><tbody>{data.content.map((item) => <tr key={item.courseSessionId}><td><span className="fw-semibold">{item.courseName}</span><small className="d-block text-muted mt-1">{item.runCode}</small></td><td>{item.unitNumber}</td><td><SessionTime startAt={item.startsAt} endAt={item.endsAt} /></td><td>{item.roomName}</td><td><Badge>{COURSE_SESSION_STATUS_LABELS[item.sessionStatus] || 'Chưa xác định'}</Badge></td><td className="text-end"><Button size="sm" variant="outline-danger" onClick={() => setSelected(item.courseSessionId)}>Học viên / điểm danh ({item.rosterCount})</Button></td></tr>)}</tbody></Table>{!data.content.length && <p className="text-center text-muted py-4 mb-0">Chưa có buổi khóa học được phân công.</p>}</>}
    <StaffPagination page={page} totalPages={data?.totalPages} totalElements={data?.totalElements} loading={!data || busy} onPageChange={setPage} />
    </Card.Body></Card>
    <Modal show={!!selected} onHide={() => { if (!busy) setSelected(null); }} size="lg" backdrop={busy ? 'static' : true} keyboard={!busy}><Modal.Header closeButton={!busy}><Modal.Title>Học viên khóa học</Modal.Title></Modal.Header><Modal.Body>
      {detailError && <Alert variant="danger">{detailError}</Alert>}
      <Button variant="outline-secondary" className="mb-3" disabled={busy} onClick={() => setRevision((v) => v + 1)}>Tải lại danh sách</Button>
      {!detail && !detailError && <p>Đang tải…</p>}
      {detail && <><p className="fw-semibold mb-1">{detail.courseName}</p><p className="text-muted">{detail.runCode} · Buổi {detail.unitNumber}</p><Alert variant="light">{reasons[detail.attendanceWriteReason] || 'Chưa xác định quyền điểm danh'}</Alert><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>Hội viên</th><th>Điểm danh</th><th className="text-end">Thao tác</th></tr></thead><tbody>{roster.map((row) => <tr key={row.enrollmentSessionId}><td><span className="fw-semibold">{row.fullName}</span><small className="d-block text-muted mt-1">{row.memberCode}</small></td><td><Badge>{COURSE_ATTENDANCE_STATUS_LABELS[row.attendanceStatus] || 'Chưa ghi nhận'}</Badge></td><td><div className="d-flex flex-wrap justify-content-end gap-2">{['PRESENT', 'ABSENT'].map((status) => <Button size="sm" variant="outline-danger" key={status} disabled={busy || !detail.attendanceWritable || row.attendanceStatus === status} onClick={() => mark(row, status)}>{COURSE_ATTENDANCE_STATUS_LABELS[status]}</Button>)}<Button as={Link} size="sm" variant="outline-secondary" to={`/coach/course-sessions/${selected}/members/${row.memberAccountId}/training`}>Kết quả và nhận xét</Button></div></td></tr>)}</tbody></Table>{!roster.length && <p>Chưa có học viên.</p>}</>}
    </Modal.Body></Modal>
  </div>;
}
