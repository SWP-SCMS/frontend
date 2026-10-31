import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { createManagerCourseRun, listManagerCourseRuns, listManagerCourses } from '../../../services/courseAdminService';
import { searchStaffAccounts } from '../../../services/staffAccountService';
import { COURSE_RUN_STATUS_LABELS, formatCourseDateTime, formatCourseMoney, getCourseErrorMessage, getCourseStatusLabel } from '../../../utils/courseUi';

const emptyForm = {
  runCode: '', courseId: '', primaryCoachId: '', tuitionVnd: '', capacity: '', minimumEnrollment: '',
  registrationOpensAt: '', registrationClosesAt: '', plannedStartAt: '', plannedEndAt: '', totalUnits: '', namedCoachCommitment: true,
};
const toIso = (value) => value ? new Date(value).toISOString() : null;

export default function ManagerCourseRunsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [] });
  const [courses, setCourses] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [runPage, coursePage, coachPage] = await Promise.all([
        listManagerCourseRuns({ page, size: 20 }),
        listManagerCourses({ page: 0, size: 100 }),
        searchStaffAccounts({ role: 'COACH', status: 'ACTIVE', page: 0, size: 100 }),
      ]);
      setResult(runPage); setCourses(coursePage.content || []); setCoaches(coachPage?.content || []);
    } catch (err) { setError(getCourseErrorMessage(err, 'Không tải được danh sách đợt mở khóa học.')); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await createManagerCourseRun({
        ...form,
        tuitionVnd: Number(form.tuitionVnd), capacity: Number(form.capacity), minimumEnrollment: Number(form.minimumEnrollment),
        totalUnits: Number(form.totalUnits), registrationOpensAt: toIso(form.registrationOpensAt), registrationClosesAt: toIso(form.registrationClosesAt),
        plannedStartAt: toIso(form.plannedStartAt), plannedEndAt: toIso(form.plannedEndAt),
      });
      setShowCreate(false); setForm(emptyForm); await load();
    } catch (err) { setError(getCourseErrorMessage(err, 'Không tạo được đợt mở khóa học.')); }
    finally { setSaving(false); }
  }

  return <div className="container-fluid py-4">
    <div className="d-flex justify-content-between align-items-start mb-4"><div><h1 className="h3 mb-1">Đợt mở khóa học</h1><p className="text-muted mb-0">Thiết lập thời gian, học phí, sĩ số và huấn luyện viên cho từng đợt.</p></div><Button variant="danger" onClick={() => setShowCreate(true)}>+ Tạo đợt mở</Button></div>
    {error && <ErrorAlert error={error} title="Không thể xử lý đợt mở khóa học" onClose={() => setError('')} />}
    <div className="bg-white rounded shadow-sm p-3">
      {loading ? <div className="text-center py-5"><Spinner /></div> : <Table responsive hover className="align-middle mb-0"><thead><tr><th>Mã đợt</th><th>Khóa học</th><th>Huấn luyện viên</th><th>Học phí</th><th>Khai giảng</th><th>Trạng thái</th><th /></tr></thead><tbody>
        {result.content.map((run) => <tr key={run.id}><td>{run.runCode}</td><td>{run.courseName}</td><td>{run.primaryCoachName}</td><td>{formatCourseMoney(run.tuitionVnd)}</td><td>{formatCourseDateTime(run.plannedStartAt)}</td><td><Badge bg="secondary">{getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, run.status)}</Badge></td><td className="text-end"><Button as={Link} to={`/manager/course-runs/${run.id}`} size="sm" variant="outline-danger">Chi tiết</Button></td></tr>)}
        {!result.content.length && <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có đợt mở khóa học.</td></tr>}
      </tbody></Table>}
      <div className="d-flex justify-content-end gap-2 mt-3"><Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((v) => v - 1)}>Trang trước</Button><Button size="sm" variant="outline-secondary" disabled={result.last || loading} onClick={() => setPage((v) => v + 1)}>Trang sau</Button></div>
    </div>

    <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="xl"><Form onSubmit={handleCreate}><Modal.Header closeButton><Modal.Title>Tạo đợt mở khóa học</Modal.Title></Modal.Header><Modal.Body><Row className="g-3">
      <Col md={4}><Form.Label>Mã đợt *</Form.Label><Form.Control required value={form.runCode} onChange={(e) => setForm({ ...form, runCode: e.target.value })} /></Col>
      <Col md={4}><Form.Label>Khóa học *</Form.Label><Form.Select required value={form.courseId} onChange={(e) => { const c = courses.find((item) => item.id === e.target.value); setForm({ ...form, courseId: e.target.value, minimumEnrollment: c?.defaultMinimumEnrollment || form.minimumEnrollment }); }}><option value="">-- Chọn khóa học --</option>{courses.filter((c) => c.status === 'PUBLISHED').map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Form.Select></Col>
      <Col md={4}><Form.Label>Huấn luyện viên chính *</Form.Label><Form.Select required value={form.primaryCoachId} onChange={(e) => setForm({ ...form, primaryCoachId: e.target.value })}><option value="">-- Chọn huấn luyện viên --</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.fullName || c.name || c.email}</option>)}</Form.Select></Col>
      <Col md={3}><Form.Label>Học phí (VND) *</Form.Label><Form.Control required type="number" min={1} value={form.tuitionVnd} onChange={(e) => setForm({ ...form, tuitionVnd: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Sức chứa *</Form.Label><Form.Control required type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Đăng ký tối thiểu *</Form.Label><Form.Control required type="number" min={1} value={form.minimumEnrollment} onChange={(e) => setForm({ ...form, minimumEnrollment: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Số buổi *</Form.Label><Form.Control required type="number" min={1} value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Mở đăng ký *</Form.Label><Form.Control required type="datetime-local" value={form.registrationOpensAt} onChange={(e) => setForm({ ...form, registrationOpensAt: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Đóng đăng ký *</Form.Label><Form.Control required type="datetime-local" value={form.registrationClosesAt} onChange={(e) => setForm({ ...form, registrationClosesAt: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Dự kiến khai giảng *</Form.Label><Form.Control required type="datetime-local" value={form.plannedStartAt} onChange={(e) => setForm({ ...form, plannedStartAt: e.target.value })} /></Col>
      <Col md={3}><Form.Label>Dự kiến kết thúc *</Form.Label><Form.Control required type="datetime-local" value={form.plannedEndAt} onChange={(e) => setForm({ ...form, plannedEndAt: e.target.value })} /></Col>
      <Col xs={12}><Form.Check type="switch" label="Cam kết đúng huấn luyện viên đã công bố" checked={form.namedCoachCommitment} onChange={(e) => setForm({ ...form, namedCoachCommitment: e.target.checked })} /></Col>
    </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Hủy</Button><Button type="submit" variant="danger" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo đợt mở'}</Button></Modal.Footer></Form></Modal>
  </div>;
}
