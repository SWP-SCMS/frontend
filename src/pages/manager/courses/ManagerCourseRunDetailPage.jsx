import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  cancelManagerCourseRun, createManagerCourseSession, getManagerCourseRun,
  listManagerCourseSessions, openManagerCourseRunRegistration,
  updateManagerCourseRun, updateManagerCourseSession,
} from '../../../services/courseAdminService';
import { listRooms } from '../../../services/roomService';
import { searchStaffAccounts } from '../../../services/staffAccountService';
import {
  formatCourseDateTime, formatCourseMoney, getCourseErrorMessage,
  COURSE_RUN_STATUS_LABELS, COURSE_SESSION_STATUS_LABELS, getCourseStatusLabel,
} from '../../../utils/courseUi';

const toIso = (value) => value ? new Date(value).toISOString() : null;
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const emptySession = { unitNumber: '', roomId: '', coachId: '', startAt: '', endAt: '', allocationVnd: '' };

export default function ManagerCourseRunDetailPage() {
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [minimumEnrollment, setMinimumEnrollment] = useState('');
  const [policyVersion, setPolicyVersion] = useState('course-mvp-v1');
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [editingSession, setEditingSession] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [runData, sessionData, roomData, coachPage] = await Promise.all([
        getManagerCourseRun(runId), listManagerCourseSessions(runId), listRooms(),
        searchStaffAccounts({ role: 'COACH', status: 'ACTIVE', page: 0, size: 100 }),
      ]);
      setRun(runData); setMinimumEnrollment(runData.minimumEnrollment); setSessions(sessionData);
      setRooms(Array.isArray(roomData) ? roomData : []); setCoaches(coachPage?.content || []);
    } catch (err) { setError(getCourseErrorMessage(err, 'Không tải được đợt mở khóa học.')); }
    finally { setLoading(false); }
  }, [runId]);
  useEffect(() => { load(); }, [load]);

  async function saveMinimum(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { setRun(await updateManagerCourseRun(runId, { expectedVersion: run.version, minimumEnrollment: Number(minimumEnrollment) })); setModal(''); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không cập nhật được số đăng ký tối thiểu.')); }
    finally { setBusy(false); }
  }

  async function openRegistration(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { setRun(await openManagerCourseRunRegistration(runId, run.version, policyVersion)); setModal(''); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không thể mở đăng ký.')); }
    finally { setBusy(false); }
  }

  async function cancelRun() {
    if (!window.confirm('Hủy đợt mở khóa học này?')) return;
    setBusy(true); setError('');
    try { setRun(await cancelManagerCourseRun(runId, run.version)); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không thể hủy đợt mở khóa học.')); }
    finally { setBusy(false); }
  }

  function openNewSession() { setEditingSession(null); setSessionForm({ ...emptySession, coachId: run.primaryCoachId }); setModal('session'); }
  function openEditSession(item) {
    setEditingSession(item);
    setSessionForm({ unitNumber: item.unitNumber, roomId: item.roomId || '', coachId: item.coachId || '', startAt: toLocalInput(item.startAt), endAt: toLocalInput(item.endAt), allocationVnd: item.allocationVnd || '' });
    setModal('session');
  }

  async function saveSession(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (editingSession) {
        await updateManagerCourseSession(runId, editingSession.id, { expectedVersion: editingSession.version, roomId: sessionForm.roomId || null, coachId: sessionForm.coachId || null, startAt: toIso(sessionForm.startAt), endAt: toIso(sessionForm.endAt) });
      } else {
        await createManagerCourseSession(runId, { unitNumber: Number(sessionForm.unitNumber), roomId: sessionForm.roomId, coachId: sessionForm.coachId, startAt: toIso(sessionForm.startAt), endAt: toIso(sessionForm.endAt), allocationVnd: Number(sessionForm.allocationVnd) });
      }
      setModal(''); await load();
    } catch (err) { setError(getCourseErrorMessage(err, 'Không lưu được buổi học.')); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!run) return <div className="container-fluid py-4"><ErrorAlert error={error} title="Không thể tải đợt mở khóa học" /></div>;

  return <div className="container-fluid py-4">
    <Link to="/manager/course-runs" className="text-decoration-none">← Quay lại danh sách đợt mở</Link>
    <div className="d-flex justify-content-between align-items-start mt-2 mb-4"><div><div className="d-flex align-items-center gap-2"><h1 className="h3 mb-0">{run.courseName}</h1><Badge bg="secondary">{getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, run.status)}</Badge></div><p className="text-muted mb-0">{run.runCode}</p></div><div className="d-flex flex-wrap gap-2"><Button variant="outline-secondary" onClick={() => setModal('minimum')}>Sửa số tối thiểu</Button>{run.status === 'DRAFT' && <Button variant="success" onClick={() => setModal('open')}>Mở đăng ký</Button>}{['DRAFT', 'OPEN_FOR_REGISTRATION'].includes(run.status) && <Button variant="outline-danger" disabled={busy} onClick={cancelRun}>Hủy đợt mở</Button>}</div></div>
    {error && <ErrorAlert error={error} title="Không thể xử lý đợt mở khóa học" onClose={() => setError('')} />}
    <Row className="g-3 mb-4"><Col lg={8}><div className="bg-white rounded shadow-sm p-4 h-100"><Row className="g-3"><Col md={6}><strong>Huấn luyện viên chính</strong><div>{run.primaryCoachName}</div></Col><Col md={3}><strong>Học phí</strong><div>{formatCourseMoney(run.tuitionVnd)}</div></Col><Col md={3}><strong>Sĩ số</strong><div>{run.minimumEnrollment}–{run.capacity}</div></Col><Col md={6}><strong>Thời gian đăng ký</strong><div>{formatCourseDateTime(run.registrationOpensAt)} – {formatCourseDateTime(run.registrationClosesAt)}</div></Col><Col md={6}><strong>Thời gian dự kiến</strong><div>{formatCourseDateTime(run.plannedStartAt)} – {formatCourseDateTime(run.plannedEndAt)}</div></Col></Row></div></Col><Col lg={4}><div className="bg-white rounded shadow-sm p-4"><strong>Số buổi</strong><div className="display-6">{run.totalUnits}</div><small className="text-muted">Chính sách: {run.policyVersionSnapshot || 'Chưa chốt'}</small></div></Col></Row>

    <div className="bg-white rounded shadow-sm p-3"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h5 mb-0">Lịch buổi học</h2><Button variant="danger" size="sm" onClick={openNewSession}>+ Thêm buổi học</Button></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Buổi</th><th>Thời gian</th><th>Phòng</th><th>Huấn luyện viên</th><th>Phân bổ học phí</th><th>Trạng thái</th><th /></tr></thead><tbody>{sessions.map((item) => <tr key={item.id}><td>{item.unitNumber}</td><td>{formatCourseDateTime(item.startAt)}<br /><small className="text-muted">đến {formatCourseDateTime(item.endAt)}</small></td><td>{item.roomName || '—'}</td><td>{item.coachName || '—'}</td><td>{formatCourseMoney(item.allocationVnd)}</td><td>{getCourseStatusLabel(COURSE_SESSION_STATUS_LABELS, item.status)}</td><td className="text-end"><Button size="sm" variant="outline-danger" onClick={() => openEditSession(item)}>Chỉnh sửa</Button></td></tr>)}{!sessions.length && <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có lịch buổi học.</td></tr>}</tbody></Table></div>

    <Modal show={modal === 'minimum'} onHide={() => setModal('')} centered><Form onSubmit={saveMinimum}><Modal.Header closeButton><Modal.Title>Sửa số đăng ký tối thiểu</Modal.Title></Modal.Header><Modal.Body><Form.Control required type="number" min={1} max={run.capacity} value={minimumEnrollment} onChange={(e) => setMinimumEnrollment(e.target.value)} /></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setModal('')}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu</Button></Modal.Footer></Form></Modal>
    <Modal show={modal === 'open'} onHide={() => setModal('')} centered><Form onSubmit={openRegistration}><Modal.Header closeButton><Modal.Title>Mở đăng ký</Modal.Title></Modal.Header><Modal.Body><Form.Label>Phiên bản chính sách *</Form.Label><Form.Control required maxLength={100} value={policyVersion} onChange={(e) => setPolicyVersion(e.target.value)} /></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setModal('')}>Hủy</Button><Button variant="success" type="submit" disabled={busy}>Xác nhận mở đăng ký</Button></Modal.Footer></Form></Modal>
    <Modal show={modal === 'session'} onHide={() => setModal('')} centered size="lg"><Form onSubmit={saveSession}><Modal.Header closeButton><Modal.Title>{editingSession ? `Chỉnh sửa buổi ${editingSession.unitNumber}` : 'Thêm buổi học'}</Modal.Title></Modal.Header><Modal.Body><Row className="g-3">
      {!editingSession && <Col md={4}><Form.Label>Số thứ tự buổi *</Form.Label><Form.Control required type="number" min={1} max={run.totalUnits} value={sessionForm.unitNumber} onChange={(e) => setSessionForm({ ...sessionForm, unitNumber: e.target.value })} /></Col>}
      <Col md={editingSession ? 6 : 4}><Form.Label>Phòng *</Form.Label><Form.Select required value={sessionForm.roomId} onChange={(e) => setSessionForm({ ...sessionForm, roomId: e.target.value })}><option value="">-- Chọn phòng --</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</Form.Select></Col>
      <Col md={editingSession ? 6 : 4}><Form.Label>Huấn luyện viên *</Form.Label><Form.Select required value={sessionForm.coachId} onChange={(e) => setSessionForm({ ...sessionForm, coachId: e.target.value })}><option value="">-- Chọn huấn luyện viên --</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.fullName || coach.name || coach.email}</option>)}</Form.Select></Col>
      <Col md={6}><Form.Label>Bắt đầu *</Form.Label><Form.Control required type="datetime-local" value={sessionForm.startAt} onChange={(e) => setSessionForm({ ...sessionForm, startAt: e.target.value })} /></Col><Col md={6}><Form.Label>Kết thúc *</Form.Label><Form.Control required type="datetime-local" value={sessionForm.endAt} onChange={(e) => setSessionForm({ ...sessionForm, endAt: e.target.value })} /></Col>
      {!editingSession && <Col md={6}><Form.Label>Học phí phân bổ (VND) *</Form.Label><Form.Control required type="number" min={0} value={sessionForm.allocationVnd} onChange={(e) => setSessionForm({ ...sessionForm, allocationVnd: e.target.value })} /></Col>}
    </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setModal('')}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu buổi học</Button></Modal.Footer></Form></Modal>
  </div>;
}
