import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  archiveManagerCourse, deactivateManagerCourse, getManagerCourse,
  publishManagerCourse, updateManagerCourse,
} from '../../../services/courseAdminService';
import { COURSE_STATUS_LABELS, getCourseErrorMessage, getCourseStatusLabel } from '../../../utils/courseUi';

export default function ManagerCourseDetailPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setCourse(await getManagerCourse(courseId)); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không tải được khóa học.')); }
    finally { setLoading(false); }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  function openEdit() {
    setForm({ name: course.name, description: course.description || '', imageUrl: course.imageUrl || '', defaultMinimumEnrollment: course.defaultMinimumEnrollment });
    setShowEdit(true);
  }

  async function handleEdit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const updated = await updateManagerCourse(courseId, {
        expectedVersion: course.version,
        ...form,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        defaultMinimumEnrollment: Number(form.defaultMinimumEnrollment),
      });
      setCourse(updated); setShowEdit(false);
    } catch (err) { setError(getCourseErrorMessage(err, 'Không cập nhật được khóa học.')); }
    finally { setBusy(false); }
  }

  async function changeStatus(action, prompt) {
    if (!window.confirm(prompt)) return;
    setBusy(true); setError('');
    try { setCourse(await action(courseId, course.version)); }
    catch (err) { setError(getCourseErrorMessage(err, 'Không đổi được trạng thái khóa học.')); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!course) return <div className="container-fluid py-4"><ErrorAlert error={error} title="Không thể tải khóa học" /></div>;

  return <div className="container-fluid py-4">
    <Link to="/manager/courses" className="text-decoration-none">← Quay lại danh mục</Link>
    <div className="d-flex justify-content-between align-items-start mt-2 mb-4">
      <div><div className="d-flex align-items-center gap-2"><h1 className="h3 mb-0">{course.name}</h1><Badge bg="secondary">{getCourseStatusLabel(COURSE_STATUS_LABELS, course.status)}</Badge></div><p className="text-muted mb-0">{course.code} · {course.disciplineName}</p></div>
      <div className="d-flex flex-wrap gap-2">
        <Button variant="outline-secondary" onClick={openEdit}>Chỉnh sửa</Button>
        {['DRAFT', 'INACTIVE'].includes(course.status) && <Button variant="success" disabled={busy} onClick={() => changeStatus(publishManagerCourse, 'Công khai khóa học này?')}>Công khai</Button>}
        {course.status === 'PUBLISHED' && <Button variant="warning" disabled={busy} onClick={() => changeStatus(deactivateManagerCourse, 'Ngừng nhận đăng ký mới cho khóa học này?')}>Ngừng hoạt động</Button>}
        {['DRAFT', 'INACTIVE'].includes(course.status) && <Button variant="outline-danger" disabled={busy} onClick={() => changeStatus(archiveManagerCourse, 'Lưu trữ khóa học này?')}>Lưu trữ</Button>}
      </div>
    </div>
    {error && <ErrorAlert error={error} title="Không thể xử lý khóa học" onClose={() => setError('')} />}
    <Row className="g-3">
      <Col lg={8}><div className="bg-white rounded shadow-sm p-4 h-100"><h2 className="h5">Thông tin khóa học</h2><p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{course.description || 'Chưa có mô tả.'}</p>{course.imageUrl && <a href={course.imageUrl} target="_blank" rel="noreferrer">Xem ảnh khóa học</a>}</div></Col>
      <Col lg={4}><div className="bg-white rounded shadow-sm p-4"><dl className="row mb-0"><dt className="col-7">Đăng ký tối thiểu</dt><dd className="col-5 text-end">{course.defaultMinimumEnrollment}</dd><dt className="col-7">Phiên bản</dt><dd className="col-5 text-end">{course.version}</dd></dl></div></Col>
    </Row>

    <Modal show={showEdit} onHide={() => setShowEdit(false)} centered size="lg"><Form onSubmit={handleEdit}>
      <Modal.Header closeButton><Modal.Title>Chỉnh sửa khóa học</Modal.Title></Modal.Header><Modal.Body><Row className="g-3">
        <Col md={8}><Form.Label>Tên khóa học *</Form.Label><Form.Control required maxLength={200} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Col>
        <Col md={4}><Form.Label>Số đăng ký tối thiểu *</Form.Label><Form.Control required type="number" min={1} value={form.defaultMinimumEnrollment || 1} onChange={(e) => setForm({ ...form, defaultMinimumEnrollment: e.target.value })} /></Col>
        <Col xs={12}><Form.Label>Ảnh khóa học (URL)</Form.Label><Form.Control maxLength={500} value={form.imageUrl || ''} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></Col>
        <Col xs={12}><Form.Label>Mô tả</Form.Label><Form.Control as="textarea" rows={5} maxLength={2000} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Col>
      </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowEdit(false)}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu thay đổi</Button></Modal.Footer>
    </Form></Modal>
  </div>;
}
