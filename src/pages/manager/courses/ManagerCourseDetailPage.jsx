import usePollingEffect from '../../../hooks/usePollingEffect';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseEditSchema } from '../../../schemas/courseSchemas';
import { useCallback, useState } from 'react';
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
  const courseForm = useForm({ resolver: zodResolver(courseEditSchema), defaultValues: {} });
  const { register, handleSubmit, reset: setForm, formState: { errors } } = courseForm;
  const [busy, setBusy] = useState(false);
  const [statusAction, setStatusAction] = useState(null);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true); commitError(setError, '');
    try { commitValue(setCourse, await getManagerCourse(courseId)); }
    catch (err) { failed(err);  commitError(setError, getCourseErrorMessage(err, 'Không tải được khóa học.')); }
    finally { if (!background) commitValue(setLoading, false); }
  }, [courseId]);
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => { track(load({ background, commitValue, commitError, failed })); }, [load], !showEdit && !busy && !statusAction);

  function openEdit() {
    setForm({ name: course.name, description: course.description || '', imageUrl: course.imageUrl || '', defaultMinimumEnrollment: course.defaultMinimumEnrollment });
    setShowEdit(true);
  }

  async function handleEdit(form) {
     setBusy(true); setError('');
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

  function changeStatus(action, prompt) {
    setError('');
    setStatusAction({ action, prompt });
  }

  async function confirmStatusChange() {
    if (!statusAction || busy) return;
    setBusy(true); setError('');
    try { setCourse(await statusAction.action(courseId, course.version)); setStatusAction(null); }
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

    <Modal show={!!statusAction} onHide={() => { if (!busy) setStatusAction(null); }} centered backdrop={busy ? 'static' : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title>Xác nhận thay đổi khóa học</Modal.Title></Modal.Header>
      <Modal.Body><p>{statusAction?.prompt}</p><p><strong>{course.name}</strong> · {course.code}</p>{error && <ErrorAlert error={error} />}</Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setStatusAction(null)}>Quay lại</Button><Button variant="danger" disabled={busy} onClick={confirmStatusChange}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></Modal.Footer>
    </Modal>
    <Modal show={showEdit} onHide={() => { if (!busy) setShowEdit(false); }} centered size="lg" backdrop={busy ? 'static' : true} keyboard={!busy}><Form noValidate onSubmit={handleSubmit(handleEdit)}>
      <Modal.Header closeButton><Modal.Title>Chỉnh sửa khóa học</Modal.Title></Modal.Header><Modal.Body>{error && <ErrorAlert error={error} title="Không thể lưu thay đổi" />}<Row className="g-3">
        <Col md={8}><Form.Label htmlFor="course-edit-name">Tên khóa học *</Form.Label><Form.Control id="course-edit-name" required maxLength={200} {...register('name')} isInvalid={!!errors.name} /><Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback></Col>
        <Col md={4}><Form.Label htmlFor="course-edit-defaultMinimumEnrollment">Số đăng ký tối thiểu *</Form.Label><Form.Control id="course-edit-defaultMinimumEnrollment" required type="number" min={1} {...register('defaultMinimumEnrollment')} isInvalid={!!errors.defaultMinimumEnrollment} /><Form.Control.Feedback type="invalid">{errors.defaultMinimumEnrollment?.message}</Form.Control.Feedback></Col>
        <Col xs={12}><Form.Label htmlFor="course-edit-imageUrl">Ảnh khóa học (URL)</Form.Label><Form.Control id="course-edit-imageUrl" maxLength={500} {...register('imageUrl')} isInvalid={!!errors.imageUrl} /><Form.Control.Feedback type="invalid">{errors.imageUrl?.message}</Form.Control.Feedback></Col>
        <Col xs={12}><Form.Label htmlFor="course-edit-description">Mô tả</Form.Label><Form.Control id="course-edit-description" as="textarea" rows={5} maxLength={2000} {...register('description')} isInvalid={!!errors.description} /><Form.Control.Feedback type="invalid">{errors.description?.message}</Form.Control.Feedback></Col>
      </Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowEdit(false)}>Hủy</Button><Button variant="danger" type="submit" disabled={busy}>Lưu thay đổi</Button></Modal.Footer>
    </Form></Modal>
  </div>;
}
