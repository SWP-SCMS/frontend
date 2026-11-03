import CourseRunRescheduleModal from './CourseRunRescheduleModal';
import CourseDateTimeInput from '../../../components/common/CourseDateTimeInput';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { minimumEnrollmentSchema, courseOpenSchema, courseSessionSchema } from '../../../schemas/courseSchemas';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { courseMakeupIds } from '../../../utils/courseWorkflow';
import {
  cancelCourseSessionWithMakeup, createManagerCourseMakeup,
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

const toIso = (value) => value ? new Date(`${value}:00+07:00`).toISOString() : null;
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() + 7 * 60 * 60000).toISOString().slice(0, 16);
};
const emptySession = { unitNumber: '', roomId: '', coachId: '', startAt: '', endAt: '', allocationVnd: '' };

export default function ManagerCourseRunDetailPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');



  const [editingSession, setEditingSession] = useState(null);
  const [makeup, setMakeup] = useState(false);
  const minimumForm = useForm({ resolver: zodResolver(minimumEnrollmentSchema(run?.capacity)), defaultValues: { minimumEnrollment: '' } });
  const openForm = useForm({ resolver: zodResolver(courseOpenSchema), defaultValues: { policyVersion: 'course-mvp-v1' } });
  const sessionFields = useForm({ resolver: zodResolver(courseSessionSchema(!!editingSession, run?.totalUnits)), defaultValues: emptySession });
  const { reset: resetMinimum } = minimumForm;
  const { reset: setSessionForm } = sessionFields;


  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [runData, sessionData, roomData, coachPage] = await Promise.all([
        getManagerCourseRun(runId), listManagerCourseSessions(runId), listRooms(),
        searchStaffAccounts({ role: 'COACH', status: 'ACTIVE', page: 0, size: 100 }),
      ]);
      setRun(runData); resetMinimum({ minimumEnrollment: runData.minimumEnrollment }); setSessions(sessionData);
      setRooms(Array.isArray(roomData) ? roomData : []); setCoaches(coachPage?.content || []);
    } catch (err) { setError(getCourseErrorMessage(err, 'Không tải được đợt mở khóa học.')); }
    finally { setLoading(false); }
  }, [runId, resetMinimum]);
  useEffect(() => { load(); }, [load]);

  async function saveMinimum({ minimumEnrollment }) {
     setBusy(true); setError('');
    try { setRun(await updateManagerCourseRun(runId, { expectedVersion: run.version, minimumEnrollment: Number(minimumEnrollment) })); setModal(''); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không cập nhật được số đăng ký tối thiểu.')); }
    finally { setBusy(false); }
  }

  async function openRegistration({ policyVersion }) {
     setBusy(true); setError('');
    try { setRun(await openManagerCourseRunRegistration(runId, run.version, policyVersion)); setModal(''); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không thể mở đăng ký.')); }
    finally { setBusy(false); }
  }

  async function cancelRun() {
    if (!window.confirm('Hủy đợt học này? Các đơn đang chờ sẽ hết hạn; khoản hoàn cho hội viên do hệ thống xác định và cần xử lý riêng.')) return;
    setBusy(true); setError('');
    try { setRun(await cancelManagerCourseRun(runId, run.version)); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không thể hủy đợt mở khóa học.')); }
    finally { setBusy(false); }
  }

  function openNewSession() { setMakeup(false); setEditingSession(null); setSessionForm({ ...emptySession, coachId: run.primaryCoachId }); setModal('session'); }
  function openEditSession(item) {
    setMakeup(false);
    setEditingSession(item);
    setSessionForm({ unitNumber: item.unitNumber, roomId: item.roomId || '', coachId: item.coachId || '', startAt: toLocalInput(item.startAt), endAt: toLocalInput(item.endAt), allocationVnd: item.allocationVnd || '' });
    setModal('session');
  }

  async function saveSession(sessionForm) {
     setBusy(true); setError('');
    try {
      if (makeup) {
        await (editingSession.status === 'CANCELLED_PENDING_MAKEUP' ? createManagerCourseMakeup : cancelCourseSessionWithMakeup)(runId, editingSession.id, { expectedVersion: editingSession.version, roomId: sessionForm.roomId, coachId: sessionForm.coachId, startAt: toIso(sessionForm.startAt), endAt: toIso(sessionForm.endAt) });
      } else if (editingSession) {
        await updateManagerCourseSession(runId, editingSession.id, { expectedVersion: editingSession.version, roomId: sessionForm.roomId || null, coachId: sessionForm.coachId || null, startAt: toIso(sessionForm.startAt), endAt: toIso(sessionForm.endAt) });
      } else {
        await createManagerCourseSession(runId, { unitNumber: Number(sessionForm.unitNumber), roomId: sessionForm.roomId, coachId: sessionForm.coachId, startAt: toIso(sessionForm.startAt), endAt: toIso(sessionForm.endAt), allocationVnd: Number(sessionForm.allocationVnd) });
      }
      setModal(''); await load();
    } catch (err) { setError(getCourseErrorMessage(err, 'Không lưu được buổi học.')); }
    finally { setBusy(false); }
  }

  const operational = ['OPEN_FOR_REGISTRATION', 'CONFIRMED', 'IN_PROGRESS'].includes(run?.status);
  const makeupIds = courseMakeupIds(sessions);
  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!run) return <div className="container-fluid py-4"><ErrorAlert error={error} title="Không thể tải đợt mở khóa học" /></div>;

  return <div className="container-fluid py-4">
    <Link to="/manager/course-runs" className="text-decoration-none">← Quay lại danh sách đợt mở</Link>
    <Link to={'/manager/reports/courses?runId=' + encodeURIComponent(runId)} className="ms-3">Báo cáo đợt học này</Link>
    <div className="d-flex justify-content-between align-items-start mt-2 mb-4"><div><div className="d-flex align-items-center gap-2"><h1 className="h3 mb-0">{run.courseName}</h1><Badge bg="secondary">{getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, run.status)}</Badge></div><p className="text-muted mb-0">{run.runCode}</p></div><div className="d-flex flex-wrap gap-2"><Button variant="outline-secondary" disabled={busy || run.status !== 'DRAFT'} onClick={() => setModal('minimum')}>Sửa số tối thiểu</Button>{run.status === 'DRAFT' && <Button variant="success" onClick={() => setModal('open')}>Mở đăng ký</Button>}{['DRAFT', 'OPEN_FOR_REGISTRATION', 'CONFIRMED', 'IN_PROGRESS'].includes(run.status) && <Button variant="outline-danger" disabled={busy} onClick={cancelRun}>Hủy đợt mở</Button>}</div></div>
    {operational && <Button className="mb-3" disabled={busy} onClick={() => setModal('schedule')}>Sửa lịch / số buổi đợt học</Button>}
    {modal === 'schedule' && <CourseRunRescheduleModal run={run} sessions={sessions} onClose={() => setModal('')} onSaved={(result) => { setRun(result.run); setSessions(result.sessions); setModal(''); setError(''); }} />}
    {error && <ErrorAlert error={error} title="Không thể xử lý đợt mở khóa học" onClose={() => setError('')} />}
    <Row className="g-3 mb-4"><Col lg={8}><div className="bg-white rounded shadow-sm p-4 h-100"><Row className="g-3"><Col md={6}><strong>Huấn luyện viên chính</strong><div>{run.primaryCoachName}</div></Col><Col md={3}><strong>Học phí</strong><div>{formatCourseMoney(run.tuitionVnd)}</div></Col><Col md={3}><strong>Sĩ số</strong><div>{run.minimumEnrollment}–{run.capacity}</div></Col><Col md={6}><strong>Thời gian đăng ký</strong><div>{formatCourseDateTime(run.registrationOpensAt)} – {formatCourseDateTime(run.registrationClosesAt)}</div></Col><Col md={6}><strong>Thời gian dự kiến</strong><div>{formatCourseDateTime(run.plannedStartAt)} – {formatCourseDateTime(run.plannedEndAt)}</div></Col></Row></div></Col><Col lg={4}><div className="bg-white rounded shadow-sm p-4"><strong>Số buổi</strong><div className="display-6">{run.totalUnits}</div><small className="text-muted">Chính sách: {run.policyVersionSnapshot || 'Chưa chốt'}</small></div></Col></Row>

    <div className="bg-white rounded shadow-sm p-3"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h5 mb-0">Lịch buổi học</h2><Button variant="danger" size="sm" onClick={openNewSession}>+ Thêm buổi học</Button></div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Buổi</th><th>Thời gian</th><th>Phòng</th><th>Huấn luyện viên</th><th>Phân bổ học phí</th><th>Trạng thái</th><th /></tr></thead><tbody>{sessions.map((item) => <tr key={item.id}><td>{item.unitNumber}</td><td>{formatCourseDateTime(item.startAt)}<br /><small className="text-muted">đến {formatCourseDateTime(item.endAt)}</small></td><td>{item.roomName || '—'}</td><td>{item.coachName || '—'}</td><td>{formatCourseMoney(item.allocationVnd)}</td><td>{getCourseStatusLabel(COURSE_SESSION_STATUS_LABELS, item.status)}</td><td className="text-end"><Button size="sm" variant="outline-danger" disabled={busy || !['SCHEDULED', 'MAKEUP_SCHEDULED'].includes(item.status)} onClick={() => openEditSession(item)}>Chỉnh sửa</Button>
      {operational && item.status === 'SCHEDULED' && !item.isMakeup && !makeupIds.has(item.id) && <Button className="ms-2" size="sm" variant="outline-danger" disabled={busy || Date.parse(item.startAt) <= now} onClick={() => { openEditSession(item); setMakeup(true); setSessionForm({ ...sessionFields.getValues(), startAt: '', endAt: '' }); }}>Hủy và xếp bù</Button>}
      {operational && item.status === 'CANCELLED_PENDING_MAKEUP' && !item.replacementSessionId && !makeupIds.has(item.id) && <Button className="ms-2" size="sm" disabled={busy} onClick={() => { openEditSession(item); setMakeup(true); setSessionForm({ ...sessionFields.getValues(), startAt: '', endAt: '' }); }}>Xếp buổi bù</Button>}
      {item.replacementSessionId && <small className="d-block">Đã liên kết buổi bù</small>}</td></tr>)}{!sessions.length && <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có lịch buổi học.</td></tr>}</tbody></Table></div>

    <Modal show={modal === 'minimum'} onHide={() => { if (!busy) setModal(''); }} backdrop={busy ? 'static' : true} keyboard={!busy} centered><Form noValidate onSubmit={minimumForm.handleSubmit(saveMinimum)}><Modal.Header closeButton={!busy}><Modal.Title>Sửa số đăng ký tối thiểu</Modal.Title></Modal.Header><Modal.Body>{error && <ErrorAlert error={error} title="Không thể lưu thay đổi" />}<Form.Label htmlFor="run-minimum">Số đăng ký tối thiểu *</Form.Label><Form.Control id="run-minimum" required type="number" min={1} max={run.capacity} {...minimumForm.register('minimumEnrollment')} isInvalid={!!minimumForm.formState.errors.minimumEnrollment} /><Form.Control.Feedback type="invalid" className="d-block">{minimumForm.formState.errors.minimumEnrollment?.message}</Form.Control.Feedback></Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setModal('')}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu</Button></Modal.Footer></Form></Modal>
    <Modal show={modal === 'open'} onHide={() => { if (!busy) setModal(''); }} backdrop={busy ? 'static' : true} keyboard={!busy} centered><Form noValidate onSubmit={openForm.handleSubmit(openRegistration)}><Modal.Header closeButton={!busy}><Modal.Title>Mở đăng ký</Modal.Title></Modal.Header><Modal.Body>{error && <ErrorAlert error={error} title="Không thể mở đăng ký" />}<Form.Label htmlFor="run-policy">Phiên bản chính sách *</Form.Label><Form.Control id="run-policy" required maxLength={100} {...openForm.register('policyVersion')} isInvalid={!!openForm.formState.errors.policyVersion} /><Form.Control.Feedback type="invalid" className="d-block">{openForm.formState.errors.policyVersion?.message}</Form.Control.Feedback></Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setModal('')}>Hủy</Button><Button variant="success" type="submit" disabled={busy}>Xác nhận mở đăng ký</Button></Modal.Footer></Form></Modal>
    <Modal show={modal === 'session'} onHide={() => { if (!busy) setModal(''); }} backdrop={busy ? 'static' : true} keyboard={!busy} centered size="lg"><Form noValidate onSubmit={sessionFields.handleSubmit(saveSession)}><Modal.Header closeButton={!busy}><Modal.Title>{makeup ? `Xếp bù buổi ${editingSession.unitNumber}` : editingSession ? `Chỉnh sửa buổi ${editingSession.unitNumber}` : 'Thêm buổi học'}</Modal.Title></Modal.Header><Modal.Body>{error && <ErrorAlert error={error} title="Không thể lưu thay đổi" />}<Row className="g-3">
      {!editingSession && <Col md={4}><Form.Label htmlFor="course-session-unitNumber">Số thứ tự buổi *</Form.Label><Form.Control id="course-session-unitNumber" required type="number" min={1} max={run.totalUnits} {...sessionFields.register('unitNumber')} isInvalid={!!sessionFields.formState.errors.unitNumber} /><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.unitNumber?.message}</Form.Control.Feedback></Col>}
      <Col md={editingSession ? 6 : 4}><Form.Label htmlFor="course-session-roomId">Phòng *</Form.Label><Form.Select id="course-session-roomId" required {...sessionFields.register('roomId')} isInvalid={!!sessionFields.formState.errors.roomId}><option value="">-- Chọn phòng --</option>{rooms.map((room) => <option key={room.id} value={room.id} disabled={room.status !== 'ACTIVE' || room.capacity < run.capacity}>{room.name}{room.status !== 'ACTIVE' ? ' (ngừng hoạt động)' : room.capacity < run.capacity ? ' (không đủ sức chứa)' : ''}</option>)}</Form.Select><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.roomId?.message}</Form.Control.Feedback></Col>
      <Col md={editingSession ? 6 : 4}><Form.Label htmlFor="course-session-coachId">Huấn luyện viên *</Form.Label><Form.Select id="course-session-coachId" required {...sessionFields.register('coachId')} isInvalid={!!sessionFields.formState.errors.coachId}><option value="">-- Chọn huấn luyện viên --</option>{coaches.map((coach) => <option key={coach.accountId} value={coach.accountId}>{coach.fullName || coach.name || coach.email}</option>)}</Form.Select><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.coachId?.message}</Form.Control.Feedback></Col>
      <Col md={6}><Form.Label htmlFor="startAt">Bắt đầu *</Form.Label><CourseDateTimeInput control={sessionFields.control} name="startAt" label="Bắt đầu" /><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.startAt?.message}</Form.Control.Feedback></Col><Col md={6}><Form.Label htmlFor="endAt">Kết thúc *</Form.Label><CourseDateTimeInput control={sessionFields.control} name="endAt" label="Kết thúc" /><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.endAt?.message}</Form.Control.Feedback></Col>
      {!editingSession && <Col md={6}><Form.Label htmlFor="course-session-allocationVnd">Học phí phân bổ (VND) *</Form.Label><Form.Control id="course-session-allocationVnd" required type="number" min={1} {...sessionFields.register('allocationVnd')} isInvalid={!!sessionFields.formState.errors.allocationVnd} /><Form.Control.Feedback type="invalid" className="d-block">{sessionFields.formState.errors.allocationVnd?.message}</Form.Control.Feedback></Col>}
    </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setModal('')}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu buổi học</Button></Modal.Footer></Form></Modal>
  </div>;
}
