import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
import CourseDateTimeInput from '../../../components/common/CourseDateTimeInput';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseRunSchema } from '../../../schemas/courseSchemas';
import { useCallback, useState } from 'react';
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
const toIso = (value) => value ? new Date(`${value}:00+07:00`).toISOString() : null;

export default function ManagerCourseRunsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [] });
  const [courses, setCourses] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const courseForm = useForm({ resolver: zodResolver(courseRunSchema), defaultValues: emptyForm });
  const { register, handleSubmit, reset: setForm, setValue, formState: { errors } } = courseForm;
  const [saving, setSaving] = useState(false);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true); commitError(setError, '');
    try {
      const [runPage, coursePage, coachPage] = await Promise.all([
        listManagerCourseRuns({ page, size: 20 }),
        listManagerCourses({ page: 0, size: 100 }),
        searchStaffAccounts({ role: 'COACH', status: 'ACTIVE', page: 0, size: 100 }),
      ]);
      commitValue(setResult, runPage); commitValue(setCourses, coursePage.content || []); commitValue(setCoaches, coachPage?.content || []);
    } catch (err) { failed(err);  commitError(setError, getCourseErrorMessage(err, 'Không tải được danh sách đợt mở khóa học.')); }
    finally { if (!background) commitValue(setLoading, false); }
  }, [page]);
  useCachedPollingEffect(({ background, track, commitValue, commitError, failed }) => { track(load({ background, commitValue, commitError, failed })); }, [load], { key: ['manager-runs', page], setters: [setResult, setCourses, setCoaches], setLoading }, !saving);

  async function handleCreate(form) {
     setSaving(true); setError('');
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

    <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="xl"><Form noValidate onSubmit={handleSubmit(handleCreate)}><Modal.Header closeButton><Modal.Title>Tạo đợt mở khóa học</Modal.Title></Modal.Header><Modal.Body>{error && <ErrorAlert error={error} title="Không thể lưu thay đổi" />}<Row className="g-3">
      <Col md={4}><Form.Label htmlFor="course-run-runCode">Mã đợt *</Form.Label><Form.Control id="course-run-runCode" required {...register('runCode')} isInvalid={!!errors.runCode} /><Form.Control.Feedback type="invalid" className="d-block">{errors.runCode?.message}</Form.Control.Feedback></Col>
      <Col md={4}><Form.Label htmlFor="course-run-courseId">Khóa học *</Form.Label><Form.Select id="course-run-courseId" required {...register('courseId', { onChange: (e) => { const c = courses.find((item) => item.id === e.target.value); if (c?.defaultMinimumEnrollment) setValue('minimumEnrollment', c.defaultMinimumEnrollment, { shouldValidate: true }); } })} isInvalid={!!errors.courseId}><option value="">-- Chọn khóa học --</option>{courses.filter((c) => c.status === 'PUBLISHED').map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Form.Select><Form.Control.Feedback type="invalid" className="d-block">{errors.courseId?.message}</Form.Control.Feedback></Col>
      <Col md={4}><Form.Label htmlFor="course-run-primaryCoachId">Huấn luyện viên chính *</Form.Label><Form.Select id="course-run-primaryCoachId" required {...register('primaryCoachId')} isInvalid={!!errors.primaryCoachId}><option value="">-- Chọn huấn luyện viên --</option>{coaches.map((c) => <option key={c.accountId} value={c.accountId}>{c.fullName || c.name || c.email}</option>)}</Form.Select><Form.Control.Feedback type="invalid" className="d-block">{errors.primaryCoachId?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="course-run-tuitionVnd">Học phí (VND) *</Form.Label><Form.Control id="course-run-tuitionVnd" required type="number" min={1} {...register('tuitionVnd')} isInvalid={!!errors.tuitionVnd} /><Form.Control.Feedback type="invalid" className="d-block">{errors.tuitionVnd?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="course-run-capacity">Sức chứa *</Form.Label><Form.Control id="course-run-capacity" required type="number" min={1} {...register('capacity')} isInvalid={!!errors.capacity} /><Form.Control.Feedback type="invalid" className="d-block">{errors.capacity?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="course-run-minimumEnrollment">Đăng ký tối thiểu *</Form.Label><Form.Control id="course-run-minimumEnrollment" required type="number" min={1} {...register('minimumEnrollment')} isInvalid={!!errors.minimumEnrollment} /><Form.Control.Feedback type="invalid" className="d-block">{errors.minimumEnrollment?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="course-run-totalUnits">Số buổi *</Form.Label><Form.Control id="course-run-totalUnits" required type="number" min={1} {...register('totalUnits')} isInvalid={!!errors.totalUnits} /><Form.Control.Feedback type="invalid" className="d-block">{errors.totalUnits?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="registrationOpensAt">Mở đăng ký *</Form.Label><CourseDateTimeInput control={courseForm.control} name="registrationOpensAt" label="Mở đăng ký" /><Form.Control.Feedback type="invalid" className="d-block">{errors.registrationOpensAt?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="registrationClosesAt">Đóng đăng ký *</Form.Label><CourseDateTimeInput control={courseForm.control} name="registrationClosesAt" label="Đóng đăng ký" /><Form.Control.Feedback type="invalid" className="d-block">{errors.registrationClosesAt?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="plannedStartAt">Dự kiến khai giảng *</Form.Label><CourseDateTimeInput control={courseForm.control} name="plannedStartAt" label="Dự kiến khai giảng" /><Form.Control.Feedback type="invalid" className="d-block">{errors.plannedStartAt?.message}</Form.Control.Feedback></Col>
      <Col md={3}><Form.Label htmlFor="plannedEndAt">Dự kiến kết thúc *</Form.Label><CourseDateTimeInput control={courseForm.control} name="plannedEndAt" label="Dự kiến kết thúc" /><Form.Control.Feedback type="invalid" className="d-block">{errors.plannedEndAt?.message}</Form.Control.Feedback></Col>
      <Col xs={12}><Form.Check type="switch" label="Cam kết đúng huấn luyện viên đã công bố" {...register('namedCoachCommitment')} isInvalid={!!errors.namedCoachCommitment} /><Form.Control.Feedback type="invalid" className="d-block">{errors.namedCoachCommitment?.message}</Form.Control.Feedback></Col>
    </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Hủy</Button><Button type="submit" variant="danger" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo đợt mở'}</Button></Modal.Footer></Form></Modal>
  </div>;
}
